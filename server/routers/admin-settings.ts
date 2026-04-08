import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getBoostFactor, setBoostFactor, getDefaultBoostFactor } from "../boost-factor";

export const adminSettingsRouter = router({
  /**
   * Get the current revenue boost factor
   */
  getBoostFactor: adminProcedure.query(async () => {
    const current = getBoostFactor();
    const defaultValue = getDefaultBoostFactor();
    return {
      current,
      default: defaultValue,
      percentageBoost: Math.round((current - 1) * 100),
      description: "Revenue boost factor applied to all AirDNA revenue and ADR values. 1.0 = no boost, 1.30 = 30% boost.",
    };
  }),

  /**
   * Set the revenue boost factor (admin only)
   */
  setBoostFactor: adminProcedure
    .input(z.object({
      factor: z.number().min(0.5).max(3.0),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await setBoostFactor(input.factor, {
        userId: ctx.user.id,
        name: ctx.user.name || ctx.user.openId,
      });
      
      if (result.success) {
        return {
          success: true,
          factor: input.factor,
          percentageBoost: Math.round((input.factor - 1) * 100),
          message: `Revenue boost updated to ${Math.round((input.factor - 1) * 100)}%. New analyses will use this value.`,
        };
      }
      
      return {
        success: false,
        factor: getBoostFactor(),
        percentageBoost: Math.round((getBoostFactor() - 1) * 100),
        message: result.error || "Failed to update boost factor",
      };
    }),
});
