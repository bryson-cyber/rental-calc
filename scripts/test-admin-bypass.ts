import { isUserAdmin, getUsageStatus } from '../server/usage-limits';
import { getDb } from '../server/db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

async function test() {
  console.log('Testing admin bypass...');
  
  const db = await getDb();
  if (!db) {
    console.log('No database connection');
    return;
  }
  
  // Find an admin user
  const [adminUser] = await db.select().from(users).where(eq(users.role, 'admin')).limit(1);
  
  if (adminUser) {
    console.log('Found admin user:', adminUser.id, adminUser.name);
    
    const isAdmin = await isUserAdmin(adminUser.id);
    console.log('isUserAdmin result:', isAdmin);
    
    const status = await getUsageStatus(adminUser.id);
    console.log('Admin status:', JSON.stringify(status, null, 2));
  } else {
    console.log('No admin user found in database');
    
    // List all users
    const allUsers = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).limit(5);
    console.log('Users in database:', allUsers);
  }
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
