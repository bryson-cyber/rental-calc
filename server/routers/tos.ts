import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { tosAcceptances } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

const CURRENT_TOS_VERSION = "1.0";

export const tosRouter = router({
  /**
   * Record TOS acceptance — stores user ID (if logged in), session ID, IP, user agent, and version.
   * Works for both authenticated and anonymous users.
   */
  accept: publicProcedure
    .input(z.object({
      tosVersion: z.string().default(CURRENT_TOS_VERSION),
      sessionId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const userId = ctx.user?.id ?? null;
      const userIp = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        || ctx.req.ip
        || null;
      const userAgent = (ctx.req.headers["user-agent"] as string) || null;

      await db.insert(tosAcceptances).values({
        userId,
        sessionId: input.sessionId || null,
        userIp,
        userAgent,
        tosVersion: input.tosVersion,
      });

      return { success: true, tosVersion: input.tosVersion };
    }),

  /**
   * Check if the current user has accepted the TOS.
   * Returns the latest acceptance record if found.
   */
  checkAcceptance: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

    const userId = ctx.user?.id;
    if (!userId) {
      return { accepted: false, tosVersion: null, acceptedAt: null };
    }

    const [record] = await db
      .select()
      .from(tosAcceptances)
      .where(eq(tosAcceptances.userId, userId))
      .orderBy(desc(tosAcceptances.acceptedAt))
      .limit(1);

    if (!record) {
      return { accepted: false, tosVersion: null, acceptedAt: null };
    }

    return {
      accepted: true,
      tosVersion: record.tosVersion,
      acceptedAt: record.acceptedAt,
    };
  }),

  /** Get the current TOS version (so frontend knows if re-acceptance is needed) */
  currentVersion: publicProcedure.query(() => {
    return { version: CURRENT_TOS_VERSION };
  }),
});
