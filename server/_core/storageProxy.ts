import type { Express, Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import { storageGet } from "../storage";
import { sdk } from "./sdk";

/**
 * Authenticated storage proxy with a per-user ACL.
 *
 * Client-facing file URLs use /manus-storage/{key}; the proxy authorizes the
 * session against the key namespace, fetches the object server-side via a
 * fresh signed URL from the Forge storage backend, and streams the bytes to
 * the client from the app's own origin. Files are therefore never addressable
 * without a valid session that owns them, and the client never touches the
 * CDN's signed URLs (whose expiry/signature quirks used to surface as raw
 * AccessDenied XML). `?download=1` switches the disposition to attachment;
 * the default renders inline so PDFs open in the browser and in the in-app
 * viewer.
 *
 * Authorization by key namespace:
 *  - generated/*                  → non-sensitive generated assets, readable
 *                                   without a session (parity with the donor
 *                                   template; nothing writes here today).
 *  - photos|audio|pdfs/{userId}/* → that user (or an admin) only.
 *  - anything else                → any signed-in user.
 */

const OWNER_NAMESPACE_PATTERN = /^(?:photos|audio|pdfs)\/(\d+)\//;

export type StorageAccessDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 401 | 403; message: string };

export function authorizeStorageKey(
  key: string,
  user: Pick<User, "id" | "role"> | null,
): StorageAccessDecision {
  // Traversal sequences are rejected before ANY namespace logic so a key can
  // never authorize under one path and resolve under another (including
  // "generated/../pdfs/7/x" abusing the open namespace).
  if (key.includes("..") || key.includes("\\")) {
    return { allowed: false, status: 400, message: "Invalid storage key" };
  }

  if (key.startsWith("generated/")) return { allowed: true };

  if (!user) {
    return { allowed: false, status: 401, message: "Sign in to view this file" };
  }

  const owner = key.match(OWNER_NAMESPACE_PATTERN);
  // Deny-by-default inside protected namespaces: a malformed pdfs|photos|audio
  // key that doesn't match the exact owner pattern is refused, not opened.
  if (!owner && /^(?:photos|audio|pdfs)\//.test(key) && user.role !== "admin") {
    return {
      allowed: false,
      status: 403,
      message: "You don't have access to this file",
    };
  }
  if (owner && user.role !== "admin" && String(user.id) !== owner[1]) {
    return {
      allowed: false,
      status: 403,
      message: "You don't have access to this file",
    };
  }

  return { allowed: true };
}

/**
 * Resolve the user behind a plain Express request (binary download routes that
 * don't go through tRPC). Session-cookie only; unauthenticated resolves null.
 */
async function resolveSessionUser(req: Request): Promise<User | null> {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  webm: "audio/webm",
  mp3: "audio/mpeg",
  txt: "text/plain",
};

function inferContentType(key: string): string {
  const extension = key.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_CONTENT_TYPES[extension] ?? "application/octet-stream";
}

/**
 * Presign + fetch the object server-side. The signed URL is consumed within
 * milliseconds of being issued, so expiry can never race the client; one
 * fresh presign retry covers transient signature/propagation hiccups. Returns
 * null (with the upstream status logged) when both attempts fail.
 */
async function fetchStorageObject(
  key: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { url } = await storageGet(key);
    if (!url) {
      console.error("[StorageProxy] empty signed URL from storage backend", { key, attempt });
      continue;
    }
    const upstream = await fetch(url);
    if (upstream.ok) {
      const upstreamType = upstream.headers.get("content-type");
      const contentType =
        upstreamType && upstreamType !== "application/octet-stream"
          ? upstreamType
          : inferContentType(key);
      return { body: Buffer.from(await upstream.arrayBuffer()), contentType };
    }
    const detail = await upstream.text().catch(() => "");
    console.error("[StorageProxy] upstream fetch failed", {
      key,
      attempt,
      status: upstream.status,
      detail: detail.slice(0, 300),
    });
  }
  return null;
}

/** Filename for Content-Disposition: last key segment, quote-safe. */
function dispositionFileName(key: string): string {
  const base = key.split("/").pop() || "file";
  return base.replace(/[^\w.\- ]/g, "").slice(0, 120) || "file";
}

export async function handleStorageProxyRequest(req: Request, res: Response) {
  const key = (req.params as Record<string, string | undefined>)["0"];
  if (!key) {
    res.status(400).send("Missing storage key");
    return;
  }

  const user = await resolveSessionUser(req);
  const decision = authorizeStorageKey(key, user);
  if (!decision.allowed) {
    res.status(decision.status).send(decision.message);
    return;
  }

  try {
    const object = await fetchStorageObject(key);
    if (!object) {
      res
        .status(502)
        .send("The file could not be retrieved right now. Please try again.");
      return;
    }
    const download = (req.query as Record<string, unknown> | undefined)?.download === "1";
    res.set("Cache-Control", "no-store");
    res.set("Content-Type", object.contentType);
    res.set(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${dispositionFileName(key)}"`,
    );
    res.send(object.body);
  } catch (error) {
    console.error("[StorageProxy] failed:", error);
    res.status(502).send("Storage proxy error");
  }
}

export function registerStorageProxy(app: Express) {
  // IMPORTANT: in production, Manus's platform edge intercepts
  // /manus-storage/* BEFORE requests reach this app (it 307-redirects to
  // signed CDN URLs with no Express involvement), so the app-owned /api
  // route below is the only path guaranteed to reach this handler. The
  // /manus-storage registration is kept for local development parity.
  app.get("/manus-storage/*", handleStorageProxyRequest);
  app.get("/api/llc/files/*", handleStorageProxyRequest);
}
