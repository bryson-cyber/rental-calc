import dotenv from 'dotenv';
dotenv.config();

console.log('API Key exists:', !!process.env.AIRDNA_API_KEY);
console.log('API Key length:', process.env.AIRDNA_API_KEY?.length || 0);

if (process.env.AIRDNA_API_KEY) {
  const address = "123 Main St, San Diego, CA";
  const url = `https://api.airdna.co/api/enterprise/v2/rentalizer/ltm?access_token=${process.env.AIRDNA_API_KEY}&address=${encodeURIComponent(address)}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log('\nAPI Response status:', data.status);
  
  if (data.payload?.stats?.future?.metrics) {
    const metrics = data.payload.stats.future.metrics;
    console.log('\n=== FULL 12-MONTH SEASONALITY FOR SAN DIEGO ===\n');
    console.log('OCCUPANCY BY MONTH:');
    metrics.forEach((m, i) => {
      const monthName = new Date(2024, i, 1).toLocaleString('en-US', { month: 'short' });
      console.log(`  ${monthName}: ${Math.round(m.occ * 100)}%`);
    });
    
    console.log('\nAVERAGE DAILY RATE BY MONTH:');
    metrics.forEach((m, i) => {
      const monthName = new Date(2024, i, 1).toLocaleString('en-US', { month: 'short' });
      console.log(`  ${monthName}: $${Math.round(m.adr)}`);
    });
  }
}
