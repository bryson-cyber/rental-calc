import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.


// ============================================
// PROPERTY IMAGE CACHING
// ============================================

import { propertyImages, InsertPropertyImage, PropertyImage } from "../drizzle/schema";
import { inArray, lt } from "drizzle-orm";

/**
 * Get cached images for a property
 * Returns null if not cached or expired
 */
export async function getCachedPropertyImages(propertyId: string): Promise<string[] | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get cached images: database not available");
    return null;
  }

  try {
    const result = await db
      .select()
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, propertyId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const cached = result[0];
    
    // Check if cache has expired
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      console.log(`[ImageCache] Cache expired for ${propertyId}`);
      return null;
    }

    console.log(`[ImageCache] Cache HIT for ${propertyId}: ${cached.imageCount} images`);
    return cached.images as string[];
  } catch (error) {
    console.error("[ImageCache] Error getting cached images:", error);
    return null;
  }
}

/**
 * Get cached images for multiple properties at once
 * Returns a map of propertyId -> images (only for cached, non-expired entries)
 */
export async function getBatchCachedPropertyImages(propertyIds: string[]): Promise<Map<string, string[]>> {
  const imageMap = new Map<string, string[]>();
  
  const db = await getDb();
  if (!db || propertyIds.length === 0) {
    return imageMap;
  }

  try {
    const results = await db
      .select()
      .from(propertyImages)
      .where(inArray(propertyImages.propertyId, propertyIds));

    const now = new Date();
    let cacheHits = 0;
    let cacheExpired = 0;

    for (const cached of results) {
      // Check if cache has expired
      if (cached.expiresAt && new Date(cached.expiresAt) < now) {
        cacheExpired++;
        continue;
      }
      
      imageMap.set(cached.propertyId, cached.images as string[]);
      cacheHits++;
    }

    console.log(`[ImageCache] Batch lookup: ${cacheHits} hits, ${cacheExpired} expired, ${propertyIds.length - cacheHits - cacheExpired} misses`);
    return imageMap;
  } catch (error) {
    console.error("[ImageCache] Error getting batch cached images:", error);
    return imageMap;
  }
}

/**
 * Cache images for a property
 * Default expiration is 7 days
 */
export async function cachePropertyImages(
  propertyId: string,
  images: string[],
  platform: string = 'airbnb',
  expirationDays: number = 7
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot cache images: database not available");
    return;
  }

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    const values: InsertPropertyImage = {
      propertyId,
      platform,
      images,
      imageCount: images.length,
      expiresAt,
    };

    await db
      .insert(propertyImages)
      .values(values)
      .onDuplicateKeyUpdate({
        set: {
          images,
          imageCount: images.length,
          expiresAt,
          fetchedAt: new Date(),
        },
      });

    console.log(`[ImageCache] Cached ${images.length} images for ${propertyId} (expires: ${expiresAt.toISOString()})`);
  } catch (error) {
    console.error("[ImageCache] Error caching images:", error);
  }
}

/**
 * Cache images for multiple properties at once
 */
export async function batchCachePropertyImages(
  imageMap: Map<string, string[]>,
  platform: string = 'airbnb',
  expirationDays: number = 7
): Promise<void> {
  const db = await getDb();
  if (!db || imageMap.size === 0) {
    return;
  }

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    const values: InsertPropertyImage[] = [];
    Array.from(imageMap.entries()).forEach(([propertyId, images]) => {
      values.push({
        propertyId,
        platform,
        images,
        imageCount: images.length,
        expiresAt,
      });
    });

    // Insert all at once with upsert
    for (const value of values) {
      await db
        .insert(propertyImages)
        .values(value)
        .onDuplicateKeyUpdate({
          set: {
            images: value.images,
            imageCount: value.imageCount,
            expiresAt,
            fetchedAt: new Date(),
          },
        });
    }

    console.log(`[ImageCache] Batch cached ${imageMap.size} properties`);
  } catch (error) {
    console.error("[ImageCache] Error batch caching images:", error);
  }
}

/**
 * Clean up expired cache entries
 */
export async function cleanupExpiredImageCache(): Promise<number> {
  const db = await getDb();
  if (!db) {
    return 0;
  }

  try {
    const result = await db
      .delete(propertyImages)
      .where(lt(propertyImages.expiresAt, new Date()));

    console.log(`[ImageCache] Cleaned up expired entries`);
    return 0; // MySQL doesn't return affected rows count easily
  } catch (error) {
    console.error("[ImageCache] Error cleaning up expired cache:", error);
    return 0;
  }
}
