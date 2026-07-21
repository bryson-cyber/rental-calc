import type { Express, Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import { storageGet } from "../storage";
import { sdk } from "./sdk";

/**
 * Authenticated storage proxy with a per-user ACL.
 *
 * Client-facing file URLs use /manus-storage/{key}; the proxy authorizes the
 * session against the key namespace and then redirects to a short-lived
 * signed URL from the Forge storage backend. Files are therefore never
 * addressable without a valid session that owns them.
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
    // Reuses this repo's Forge presign helper (v1/storage/downloadUrl).
    const { url } = await storageGet(key);
    if (!url) {
      res.status(502).send("Empty signed URL from storage backend");
      return;
    }
    res.set("Cache-Control", "no-store");
    res.redirect(307, url);
  } catch (error) {
    console.error("[StorageProxy] failed:", error);
    res.status(502).send("Storage proxy error");
  }
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", handleStorageProxyRequest);
}
