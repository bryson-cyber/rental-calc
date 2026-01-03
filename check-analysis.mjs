import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkLatestAnalysis() {
  try {
    const result = await pool.query(`
      SELECT id, address, created_at, 
             jsonb_typeof(analysis_data->'photo_analysis') as photo_analysis_type,
             analysis_data->'photo_analysis'->'competitor_photos' as competitor_photos,
             analysis_data->'photo_analysis'->'design_insights' as design_insights
      FROM analyses 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('Latest Analysis:');
      console.log('  ID:', row.id);
      console.log('  Address:', row.address);
      console.log('  Created:', row.created_at);
      console.log('  Photo Analysis Type:', row.photo_analysis_type);
      console.log('  Competitor Photos:', JSON.stringify(row.competitor_photos, null, 2));
      console.log('  Design Insights:', JSON.stringify(row.design_insights, null, 2));
    } else {
      console.log('No analyses found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkLatestAnalysis();
