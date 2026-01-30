import { getDb } from './db';
import { regulationCache } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

export async function getSourcesForCity(city: string) {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select({
    city: regulationCache.city,
    sources: regulationCache.sources
  }).from(regulationCache).where(eq(regulationCache.city, city)).limit(1);
  
  return results[0] || null;
}
