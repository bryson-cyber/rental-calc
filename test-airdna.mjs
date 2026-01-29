import 'dotenv/config';

const apiKey = process.env.AIRDNA_API_KEY;
console.log('API Key exists:', !!apiKey);

const response = await fetch('https://api.airdna.co/api/enterprise/v2/rentalizer/estimate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    address: '419 Saint Paul St, Denver, CO 80206',
    bedrooms: 3,
    bathrooms: 4,
    accommodates: 6,
    currency: 'usd'
  })
});

const data = await response.json();
console.log('Status:', data.status?.type);

if (data.payload?.property?.stats?.summary) {
  const s = data.payload.property.stats.summary;
  console.log('Revenue:', s.revenue);
  console.log('Occupancy:', s.occupancy);
  console.log('ADR:', s.adr);
} else {
  console.log('Full response:', JSON.stringify(data, null, 2).slice(0, 3000));
}
