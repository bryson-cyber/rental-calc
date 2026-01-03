/**
 * Poe AI Service - Uses OpenAI-compatible API with Claude Opus and Gemini 3
 * 
 * This service provides AI-powered narrative generation using Poe's API
 * which gives access to Claude Opus for high-quality writing and
 * Gemini 3 Pro for multimodal (image) analysis.
 */

import { ENV } from './_core/env';

const POE_API_URL = 'https://api.poe.com/v1/chat/completions';

// Available models
const MODELS = {
  CLAUDE_OPUS: 'Claude-Opus-4.1',    // Best for writing/narratives
  GEMINI_3_PRO: 'Gemini-3-Pro',      // Best for vision/multimodal
  GEMINI_2_5_PRO: 'Gemini-2.5-Pro',  // Alternative Gemini model
  CLAUDE_SONNET: 'Claude-Sonnet-4',  // Faster Claude alternative
};

// Default model - Claude Opus for best writing quality
const DEFAULT_MODEL = MODELS.CLAUDE_OPUS;

// Vision model - Gemini 3 Pro for image analysis
const VISION_MODEL = MODELS.GEMINI_3_PRO;

interface PoeMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | PoeMessageContent[];
}

interface PoeMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface PoeCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call Poe AI with retry logic and timeout
 */
export async function callPoeAI(
  messages: PoeMessage[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    stream?: boolean;
    retries?: number;
  } = {}
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    temperature = 0.7,
    timeoutMs = 120000, // 120 second timeout (increased from 60s)
    stream = false,
    retries = 2, // Retry up to 2 times on failure
  } = options;

  const apiKey = ENV.poeApiKey;
  if (!apiKey) {
    throw new Error('POE_API_KEY is not configured');
  }

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (attempt > 0) {
        console.log(`[PoeAI] Retry attempt ${attempt}/${retries}...`);
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
      
      console.log(`[PoeAI] Calling ${model} with ${messages.length} messages...`);
      
      const response = await fetch(POE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          stream,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Poe API error (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data: PoeCompletionResponse = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      if (!content) {
        throw new Error('Empty response from Poe AI');
      }

      console.log(`[PoeAI] Response received: ${content.length} chars, ${data.usage?.total_tokens || 'unknown'} tokens`);
      return content;
    } catch (error: any) {
      lastError = error;
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error(`[PoeAI] Timeout after ${timeoutMs / 1000}s (attempt ${attempt + 1}/${retries + 1})`);
        lastError = new Error(`Poe AI timeout after ${timeoutMs / 1000} seconds`);
      } else {
        console.error(`[PoeAI] Error (attempt ${attempt + 1}/${retries + 1}):`, error.message);
      }
      
      // Don't retry on certain errors
      if (error.message?.includes('not configured') || error.message?.includes('401')) {
        throw error;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  // All retries exhausted
  throw lastError || new Error('Poe AI request failed after all retries');
}

/**
 * Generate narrative report using Claude Opus via Poe
 */
export async function generateNarrativeWithPoe(
  prompt: string,
  options: {
    systemPrompt?: string;
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<string> {
  const {
    systemPrompt = 'You are a senior short-term rental investment analyst. Write clear, specific, and actionable analysis in flowing paragraphs. Use specific numbers and explain what they mean for the investor.',
    model = DEFAULT_MODEL,
    maxTokens = 4096,
    timeoutMs = 150000, // 150 second timeout (increased from 60s)
  } = options;

  const messages: PoeMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  return callPoeAI(messages, { model, maxTokens, timeoutMs });
}

/**
 * Analyze an image using Gemini 3 Pro via Poe
 * Supports both URL and base64-encoded images
 */
export async function analyzeImageWithPoe(
  imageUrl: string,
  prompt: string,
  options: {
    systemPrompt?: string;
    maxTokens?: number;
    timeoutMs?: number;
    retries?: number;
  } = {}
): Promise<string> {
  const {
    systemPrompt = 'You are an expert at analyzing Airbnb listing photos. Provide detailed, actionable insights about the property.',
    maxTokens = 2048,
    timeoutMs = 45000, // 45 second timeout for image analysis
    retries = 2, // Default to 2 retries
  } = options;

  // Build multimodal message content
  const content: PoeMessageContent[] = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: imageUrl } },
  ];

  const messages: PoeMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content },
  ];

  console.log(`[PoeVision] Analyzing image with ${VISION_MODEL}...`);
  
  return callPoeAI(messages, {
    model: VISION_MODEL,
    maxTokens,
    timeoutMs,
    retries,
    stream: false, // Recommended for media bots
  });
}

/**
 * Analyze multiple images at once using Gemini 3 Pro via Poe
 */
export async function analyzeMultipleImagesWithPoe(
  imageUrls: string[],
  prompt: string,
  options: {
    systemPrompt?: string;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<string> {
  const {
    systemPrompt = 'You are an expert at analyzing Airbnb listing photos. Provide detailed, actionable insights about the properties shown.',
    maxTokens = 4096,
    timeoutMs = 60000, // 60 second timeout for multiple images
  } = options;

  // Build multimodal message content with all images
  const content: PoeMessageContent[] = [
    { type: 'text', text: prompt },
    ...imageUrls.map(url => ({
      type: 'image_url' as const,
      image_url: { url },
    })),
  ];

  const messages: PoeMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content },
  ];

  console.log(`[PoeVision] Analyzing ${imageUrls.length} images with ${VISION_MODEL}...`);
  
  return callPoeAI(messages, {
    model: VISION_MODEL,
    maxTokens,
    timeoutMs,
    stream: false,
  });
}

/**
 * Analyze a listing photo for Airbnb arbitrage analysis
 */
export async function analyzeListingPhoto(
  imageUrl: string,
  context?: {
    propertyType?: string;
    bedrooms?: number;
    location?: string;
  }
): Promise<{
  quality_score: number;
  design_themes: string[];
  visible_amenities: string[];
  guest_appeal: string;
  improvement_suggestions: string[];
  professional_quality: boolean;
}> {
  const contextInfo = context
    ? `Property context: ${context.propertyType || 'Unknown'} with ${context.bedrooms || 'unknown'} bedrooms in ${context.location || 'unknown location'}.`
    : '';

  const prompt = `Analyze this Airbnb listing photo and provide a detailed assessment.
${contextInfo}

Please evaluate:
1. Photo quality (1-10 scale)
2. Design themes visible (modern, rustic, minimalist, luxury, etc.)
3. Amenities visible in the photo
4. Guest appeal factors
5. Suggestions for improvement
6. Whether this appears to be professional photography

Respond in JSON format:
{
  "quality_score": <1-10>,
  "design_themes": ["theme1", "theme2"],
  "visible_amenities": ["amenity1", "amenity2"],
  "guest_appeal": "Brief description of what makes this appealing to guests",
  "improvement_suggestions": ["suggestion1", "suggestion2"],
  "professional_quality": true/false
}`;

  try {
    const response = await analyzeImageWithPoe(imageUrl, prompt, {
      systemPrompt: 'You are an expert Airbnb photographer and interior designer. Analyze listing photos and provide actionable insights. Always respond in valid JSON format.',
      maxTokens: 1024,
      timeoutMs: 30000,
    });

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback if JSON parsing fails
    return {
      quality_score: 5,
      design_themes: ['Unable to analyze'],
      visible_amenities: [],
      guest_appeal: 'Analysis unavailable',
      improvement_suggestions: [],
      professional_quality: false,
    };
  } catch (error: any) {
    console.error('[PoeVision] Error analyzing listing photo:', error.message);
    throw error;
  }
}

/**
 * Analyze competitor photos to identify design patterns
 */
export async function analyzeCompetitorPhotos(
  imageUrls: string[],
  marketContext?: string
): Promise<{
  common_themes: string[];
  quality_benchmark: number;
  standout_features: string[];
  market_expectations: string;
  recommendations: string[];
}> {
  const contextInfo = marketContext
    ? `Market context: ${marketContext}`
    : '';

  const prompt = `Analyze these ${imageUrls.length} Airbnb competitor listing photos from the same market.
${contextInfo}

Identify:
1. Common design themes across listings
2. Average quality benchmark (1-10)
3. Standout features that top performers have
4. What guests in this market expect based on these photos
5. Recommendations for a new listing to compete

Respond in JSON format:
{
  "common_themes": ["theme1", "theme2"],
  "quality_benchmark": <1-10>,
  "standout_features": ["feature1", "feature2"],
  "market_expectations": "What guests expect in this market",
  "recommendations": ["recommendation1", "recommendation2"]
}`;

  try {
    const response = await analyzeMultipleImagesWithPoe(imageUrls, prompt, {
      systemPrompt: 'You are an expert Airbnb market analyst specializing in visual competitive analysis. Identify patterns and provide actionable recommendations. Always respond in valid JSON format.',
      maxTokens: 2048,
      timeoutMs: 60000,
    });

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback if JSON parsing fails
    return {
      common_themes: ['Unable to analyze'],
      quality_benchmark: 5,
      standout_features: [],
      market_expectations: 'Analysis unavailable',
      recommendations: [],
    };
  } catch (error: any) {
    console.error('[PoeVision] Error analyzing competitor photos:', error.message);
    throw error;
  }
}

/**
 * Test the Poe API connection
 */
export async function testPoeConnection(): Promise<{ success: boolean; message: string; model?: string }> {
  try {
    const response = await callPoeAI(
      [{ role: 'user', content: 'Say "Hello" and nothing else.' }],
      { maxTokens: 50, timeoutMs: 15000 }
    );
    
    return {
      success: true,
      message: `Poe AI connected successfully. Response: ${response.trim()}`,
      model: DEFAULT_MODEL,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Poe AI connection failed: ${error.message}`,
    };
  }
}

/**
 * Test the Poe Vision API connection with Gemini 3
 */
export async function testPoeVisionConnection(): Promise<{ success: boolean; message: string; model?: string }> {
  try {
    // Use a simple test image URL
    const testImageUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/200px-PNG_transparency_demonstration_1.png';
    
    const response = await analyzeImageWithPoe(
      testImageUrl,
      'Describe what you see in this image in one sentence.',
      { maxTokens: 100, timeoutMs: 20000 }
    );
    
    return {
      success: true,
      message: `Poe Vision connected successfully. Response: ${response.trim().substring(0, 100)}...`,
      model: VISION_MODEL,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Poe Vision connection failed: ${error.message}`,
    };
  }
}

// Export models for external use
export { MODELS, DEFAULT_MODEL, VISION_MODEL };
