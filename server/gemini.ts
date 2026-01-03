/**
 * Gemini AI Service for Property Analysis
 * 
 * This service uses Google's Gemini AI to generate educational,
 * easy-to-understand content for rental property analysis reports.
 */

import { ENV } from './_core/env';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface InvestmentAdvisorContext {
  markets?: Array<{
    name: string;
    scores: {
      market_score: number;
      investability: number;
      rental_demand: number;
      revenue_growth: number;
      seasonality: number;
      regulation: number;
    };
    metrics: {
      occupancy: number;
      revenue: number;
      adr: number;
    };
    listing_count: number;
  }>;
}

async function callGemini(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout
  
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${ENV.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data: GeminiResponse = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getInvestmentAdvice(
  question: string,
  conversationHistory: ChatMessage[],
  context?: InvestmentAdvisorContext
): Promise<string> {
  // Build context string from market data if available
  let marketContext = '';
  if (context?.markets && context.markets.length > 0) {
    marketContext = `\n\nAvailable Market Data:\n${context.markets.map(m => 
      `- ${m.name}: Score ${m.scores.market_score}/100, Investability ${m.scores.investability}, Demand ${m.scores.rental_demand}, Revenue Growth ${m.scores.revenue_growth}, Seasonality ${m.scores.seasonality}, Regulation ${m.scores.regulation}, Avg Revenue $${m.metrics.revenue.toLocaleString()}, Occupancy ${m.metrics.occupancy}%, ADR $${m.metrics.adr}, ${m.listing_count.toLocaleString()} listings`
    ).join('\n')}`;
  }

  // Build conversation history
  const historyText = conversationHistory.length > 0 
    ? `\n\nConversation History:\n${conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Advisor'}: ${m.content}`).join('\n')}`
    : '';

  const prompt = `You are a short-term rental investment advisor. Your ONLY source of information is the AirDNA market data provided below.

CRITICAL RULE: You MUST ONLY use the AirDNA data provided. Do NOT use general knowledge, assumptions, or external information.

If a user asks about markets or data NOT in the provided dataset:
- Say "I don't have data on that market yet" or "That information isn't in my current dataset"
- Suggest analyzing markets you DO have data for
- Do NOT make up or assume information

Your role:
- Compare markets using ONLY the provided data
- Analyze revenue, occupancy, ADR, seasonality, and investment scores
- Help investors understand what the data shows
- Be conversational but always data-driven

Guidelines:
1. ONLY reference markets in the dataset provided
2. Use specific numbers and percentages from the data
3. If data is missing for a market, say so clearly
4. Keep responses concise (2-4 paragraphs)
5. Use bullet points for market comparisons
6. Explain what each metric means
7. Never provide investment advice beyond what the data shows
${marketContext}${historyText}

User Question: ${question}

Respond based ONLY on the AirDNA data above. If the data doesn't cover the question, say so clearly.`;

  try {
    const response = await callGemini(prompt);
    return response.trim();
  } catch (error) {
    console.error('Error getting investment advice:', error);
    return "I apologize, but I'm having trouble processing your question right now. Please try again in a moment, or feel free to rephrase your question.";
  }
}


export async function generateEnhancedPropertyReport(
  address: string,
  features: Record<string, unknown>
): Promise<string> {
  const prompt = `Generate a brief, professional property analysis for: ${address}
  
Features: ${JSON.stringify(features)}

Provide 2-3 paragraphs highlighting key investment potential.`;

  try {
    return await callGemini(prompt);
  } catch (error) {
    console.error('Error generating property report:', error);
    return 'Unable to generate report at this time.';
  }
}

export async function generateEnhancedMarketReport(
  marketName: string,
  marketData: Record<string, unknown>
): Promise<string> {
  const prompt = `Generate a brief market analysis for ${marketName}:
  
Data: ${JSON.stringify(marketData)}

Provide 2-3 paragraphs on market opportunity, trends, and investment potential.`;

  try {
    return await callGemini(prompt);
  } catch (error) {
    console.error('Error generating market report:', error);
    return 'Unable to generate report at this time.';
  }
}

export async function compareMarketsForInvestment(
  markets: Array<{ name: string; scores: Record<string, number>; metrics: Record<string, number> }>,
  investorProfile?: { budget?: number; goals?: string; riskTolerance?: string }
): Promise<string> {
  const marketSummary = markets.map(m => 
    `${m.name}: Score ${m.scores.market_score}/100, Revenue $${m.metrics.revenue}, Occupancy ${m.metrics.occupancy}%`
  ).join('\n');

  const prompt = `Compare these markets for short-term rental investment:

${marketSummary}

${investorProfile ? `Investor Profile: Budget $${investorProfile.budget}, Goals: ${investorProfile.goals}, Risk: ${investorProfile.riskTolerance}` : ''}

Provide a brief comparison with recommendation.`;

  try {
    return await callGemini(prompt);
  } catch (error) {
    console.error('Error comparing markets:', error);
    return 'Unable to compare markets at this time.';
  }
}
