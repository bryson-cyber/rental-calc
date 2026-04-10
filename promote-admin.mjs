import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL + '&ssl={"rejectUnauthorized":true}');
  
  // First check if user exists
  const [rows] = await conn.execute('SELECT id, email, role, name FROM users WHERE email = ?', ['dfy@coachinayah.com']);
  
  if (rows.length === 0) {
    console.log('User dfy@coachinayah.com NOT FOUND in the database.');
    console.log('\nLet me check all users to see what emails exist:');
    const [allUsers] = await conn.execute('SELECT id, email, role, name FROM users ORDER BY id');
    allUsers.forEach(u => console.log(`  ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Name: ${u.name}`));
  } else {
    const user = rows[0];
    console.log(`Found user: ID=${user.id}, Email=${user.email}, Role=${user.role}, Name=${user.name}`);
    
    if (user.role === 'admin') {
      console.log('User is ALREADY an admin. No changes needed.');
    } else {
      // Promote to admin
      await conn.execute('UPDATE users SET role = ? WHERE email = ?', ['admin', 'dfy@coachinayah.com']);
      console.log('SUCCESS: User promoted to admin!');
      
      // Verify
      const [verify] = await conn.execute('SELECT id, email, role FROM users WHERE email = ?', ['dfy@coachinayah.com']);
      console.log(`Verified: Role is now "${verify[0].role}"`);
    }
  }
  
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
