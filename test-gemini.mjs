// Test Gemini API with Google Search grounding
const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key exists:', !!apiKey);
console.log('API Key length:', apiKey?.length);

if (!apiKey) {
  console.log('ERROR: No API key found');
  process.exit(1);
}

// Test a simple API call
const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=' + apiKey, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 'What are the current short-term rental (Airbnb) regulations in St. Louis, Missouri? Search for official government sources. Return a JSON object with status, permitRequired, primaryResidenceOnly fields.' }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
  })
});

const data = await response.json();

console.log('Response status:', response.status);
console.log('Has error:', !!data.error);

if (data.error) {
  console.log('Error:', JSON.stringify(data.error, null, 2));
} else {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('Text length:', text?.length);
  console.log('Text preview:', text?.slice(0, 1000));
  console.log('');
  console.log('Sources count:', data.candidates?.[0]?.groundingMetadata?.groundingChunks?.length);
  console.log('Source URLs:', data.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web?.uri));
}
