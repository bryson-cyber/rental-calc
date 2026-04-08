/**
 * Revenue Boost Factor Service
 * 
 * Manages the revenue boost factor that's applied to all AirDNA revenue/ADR values.
 * The factor is stored in the admin_settings table and synced to the in-memory
 * REVENUE_BOOST_FACTOR variable in airdna.ts.
 * 
 * Flow:
 * 1. On server startup, initBoostFactor() reads from DB and sets the in-memory value
 * 2. When admin changes the factor, setBoostFactor() updates DB + in-memory value
 * 3. All 78 call sites in airdna.ts use the in-memory REVENUE_BOOST_FACTOR (no async needed)
 */

import { getDb } from "./db";
import { adminSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { setBoostFactorValue, REVENUE_BOOST_FACTOR } from "./airdna";

// Setting key in admin_settings table
const BOOST_FACTOR_KEY = "revenue_boost_factor";

// Default boost factor
const DEFAULT_BOOST_FACTOR = 1.30;

/**
 * Initialize the boost factor from DB on server startup.
 * Call this once during server initialization.
 */
export async function initBoostFactor(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[BoostFactor] DB unavailable at init, using default:", DEFAULT_BOOST_FACTOR);
      return;
    }
    
    const [setting] = await db.select()
      .from(adminSettings)
      .where(eq(adminSettings.settingKey, BOOST_FACTOR_KEY))
      .limit(1);
    
    if (setting) {
      const value = parseFloat(setting.settingValue);
      if (!isNaN(value) && value >= 0.5 && value <= 3.0) {
        setBoostFactorValue(value);
        console.log("[BoostFactor] Loaded from DB:", value);
        return;
      }
    }
    
    // No setting found — seed the default
    try {
      await db.insert(adminSettings).values({
        settingKey: BOOST_FACTOR_KEY,
        settingValue: String(DEFAULT_BOOST_FACTOR),
        description: "Revenue boost factor applied to all AirDNA revenue and ADR values. 1.0 = no boost, 1.30 = 30% boost.",
      });
      console.log("[BoostFactor] Seeded default:", DEFAULT_BOOST_FACTOR);
    } catch {
      // Ignore duplicate key errors
    }
    
    setBoostFactorValue(DEFAULT_BOOST_FACTOR);
  } catch (error) {
    console.error("[BoostFactor] Init error:", error);
  }
}

/**
 * Get the current boost factor (reads the in-memory value, no DB call).
 */
export function getBoostFactor(): number {
  return REVENUE_BOOST_FACTOR;
}

/**
 * Set the revenue boost factor.
 * Updates the DB AND the in-memory value in airdna.ts.
 */
export async function setBoostFactor(
  factor: number,
  updatedBy?: { userId: number; name: string }
): Promise<{ success: boolean; error?: string }> {
  if (factor < 0.5 || factor > 3.0) {
    return { success: false, error: "Boost factor must be between 0.5 (50% reduction) and 3.0 (200% boost)" };
  }
  
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, error: "Database unavailable" };
    }
    
    // Upsert the setting
    const [existing] = await db.select()
      .from(adminSettings)
      .where(eq(adminSettings.settingKey, BOOST_FACTOR_KEY))
      .limit(1);
    
    if (existing) {
      await db.update(adminSettings)
        .set({
          settingValue: String(factor),
          updatedByUserId: updatedBy?.userId,
          updatedByName: updatedBy?.name,
        })
        .where(eq(adminSettings.settingKey, BOOST_FACTOR_KEY));
    } else {
      await db.insert(adminSettings).values({
        settingKey: BOOST_FACTOR_KEY,
        settingValue: String(factor),
        description: "Revenue boost factor applied to all AirDNA revenue and ADR values. 1.0 = no boost, 1.30 = 30% boost.",
        updatedByUserId: updatedBy?.userId,
        updatedByName: updatedBy?.name,
      });
    }
    
    // Update the in-memory value immediately
    setBoostFactorValue(factor);
    
    console.log(`[BoostFactor] Updated to ${factor} (${Math.round((factor - 1) * 100)}% boost) by ${updatedBy?.name || 'unknown'}`);
    return { success: true };
  } catch (error) {
    console.error("[BoostFactor] Error setting factor:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Get the default boost factor (for reference/display)
 */
export function getDefaultBoostFactor(): number {
  return DEFAULT_BOOST_FACTOR;
}
