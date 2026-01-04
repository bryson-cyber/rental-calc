// Check the fullAnalysisData structure for report 660004
import { createConnection } from 'mysql2/promise';

async function main() {
  const conn = await createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    ssl: { rejectUnauthorized: false }
  });
  
  const [rows] = await conn.execute(
    'SELECT fullAnalysisData FROM analysis_reports WHERE id = 660004'
  );
  
  if (rows.length > 0) {
    const data = rows[0].fullAnalysisData;
    console.log('=== Full Analysis Data Structure ===');
    console.log('Type:', typeof data);
    
    if (typeof data === 'string') {
      const parsed = JSON.parse(data);
      console.log('Top-level keys:', Object.keys(parsed));
      
      // Check for profitability
      if (parsed.profitability) {
        console.log('\n=== Profitability ===');
        console.log(JSON.stringify(parsed.profitability, null, 2));
      }
      
      // Check for property_estimate
      if (parsed.property_estimate) {
        console.log('\n=== Property Estimate ===');
        console.log(JSON.stringify(parsed.property_estimate, null, 2));
      }
      
      // Check for monthly_rent
      console.log('\n=== Monthly Rent ===');
      console.log('monthly_rent:', parsed.monthly_rent);
      
    } else if (typeof data === 'object') {
      console.log('Top-level keys:', Object.keys(data));
      
      if (data.profitability) {
        console.log('\n=== Profitability ===');
        console.log(JSON.stringify(data.profitability, null, 2));
      }
      
      if (data.property_estimate) {
        console.log('\n=== Property Estimate ===');
        console.log(JSON.stringify(data.property_estimate, null, 2));
      }
      
      console.log('\n=== Monthly Rent ===');
      console.log('monthly_rent:', data.monthly_rent);
    }
  }
  
  await conn.end();
}

main().catch(console.error);
