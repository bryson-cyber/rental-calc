import { getDb } from './server/db';
import { regulationCache } from './drizzle/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) {
    console.log('No database connection');
    return;
  }
  
  const results = await db.select().from(regulationCache).where(eq(regulationCache.city, 'Denver')).limit(1);
  console.log('Sources for Denver:');
  console.log(JSON.stringify(results[0]?.sources, null, 2));
}

main().catch(console.error);
