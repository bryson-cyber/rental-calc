import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.AIRDNA_API_KEY;
const address = "7544 Decatur Dr, Fayetteville, NC 28303";

async function testRentalizer() {
  console.log("Testing AirDNA Rentalizer with:", address);
  console.log("API Key present:", !!API_KEY);
  
  const response = await fetch("https://api.airdna.co/api/enterprise/v2/rentalizer/estimate", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      address: address,
      bedrooms: 3,
      bathrooms: 2,
      accommodates: 6,
      currency: "usd",
    }),
  });
  
  const text = await response.text();
  console.log("Response status:", response.status);
  if (!response.ok || text.startsWith('<!DOCTYPE')) {
    console.log("Non-JSON response (first 500 chars):", text.substring(0, 500));
    return;
  }
  const data = JSON.parse(text);
  console.log("\n=== RESULTS ===");
  console.log("Status:", response.status);
  console.log("Address:", data.payload?.details?.address);
  console.log("Address Lookup:", data.payload?.details?.address_lookup);
  console.log("Zipcode:", data.payload?.details?.zipcode);
  console.log("Location:", JSON.stringify(data.payload?.location));
  console.log("Market ID:", data.payload?.location?.market_id);
  
  // Check if the state is correct
  const returnedAddress = data.payload?.details?.address || '';
  const returnedLookup = data.payload?.details?.address_lookup || '';
  console.log("\n=== STATE CHECK ===");
  console.log("Address contains NC:", returnedAddress.includes('NC') || returnedAddress.includes('North Carolina'));
  console.log("Address contains AR:", returnedAddress.includes('AR') || returnedAddress.includes('Arkansas'));
  console.log("Lookup contains NC:", returnedLookup.includes('NC') || returnedLookup.includes('North Carolina'));
  console.log("Lookup contains AR:", returnedLookup.includes('AR') || returnedLookup.includes('Arkansas'));
}

testRentalizer().catch(console.error);
