import dotenv from 'dotenv';
const result = dotenv.config();
console.log('dotenv result:', result);
console.log('AIRDNA_API_KEY exists:', !!process.env.AIRDNA_API_KEY);
console.log('AIRDNA_API_KEY length:', process.env.AIRDNA_API_KEY?.length || 0);
