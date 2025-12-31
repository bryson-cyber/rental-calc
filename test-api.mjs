const response = await fetch('http://localhost:3000/trpc/rental.getPropertyReport', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    json: {
      address: '1321 15th St, Denver, CO 80202',
      bedrooms: 2,
      bathrooms: 1,
      accommodates: 4
    }
  })
});

const data = await response.json();
console.log('Success:', data.result?.data?.success);
console.log('Keys:', Object.keys(data.result?.data?.data || {}));
console.log('Market exists:', !!data.result?.data?.data?.market);

if (data.result?.data?.data?.market) {
  const market = data.result.data.data.market;
  console.log('Market name:', market.name);
  console.log('Market metrics:', JSON.stringify(market.metrics, null, 2));
  console.log('Has historical:', !!market.historical);
  if (market.historical) {
    console.log('Historical ADR count:', market.historical.adr?.length || 0);
    console.log('Historical occupancy count:', market.historical.occupancy?.length || 0);
  }
}
