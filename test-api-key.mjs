import 'dotenv/config';
console.log('API Key exists:', !!process.env.AIRDNA_API_KEY);
console.log('API Key length:', process.env.AIRDNA_API_KEY?.length);
console.log('API Key prefix:', process.env.AIRDNA_API_KEY?.substring(0, 8));
