import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { users } from "../../drizzle/schema";

export const behaviorEngineRouter = router({
    // Get a user's behavior profile
    getUserProfile: protectedProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        const { buildUserBehaviorProfile } = await import('../behavior-engine');
        return buildUserBehaviorProfile(input.email);
      }),

    // Preview what adaptive email would be sent to a user
    previewAdaptiveEmail: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        strategy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { buildUserBehaviorProfile, generateAdaptiveEmail, selectEmailStrategy } = await import('../behavior-engine');
        const profile = await buildUserBehaviorProfile(input.email);
        if (!profile) throw new Error('User not found');
        const strategy = (input.strategy || selectEmailStrategy(profile)) as any;
        const email = await generateAdaptiveEmail(profile, strategy);
        return { profile, email };
      }),

    // Get engagement analytics for the admin dashboard
    getEngagementAnalytics: protectedProcedure
      .query(async () => {
        const { getEngagementAnalytics } = await import('../behavior-engine');
        return getEngagementAnalytics();
      }),

    // Process adaptive follow-ups for a batch of users
    processFollowUps: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
      .mutation(async ({ input }) => {
        const { processAdaptiveFollowUps } = await import('../behavior-engine');
        return processAdaptiveFollowUps(input.limit);
      }),

    // Get strategy recommendation for a specific user
    getStrategy: protectedProcedure
      .input(z.object({ email: z.string().email() }))
      .query(async ({ input }) => {
        const { buildUserBehaviorProfile, selectEmailStrategy } = await import('../behavior-engine');
        const profile = await buildUserBehaviorProfile(input.email);
        if (!profile) return null;
        const strategy = selectEmailStrategy(profile);
        return { profile, strategy };
      }),
});
