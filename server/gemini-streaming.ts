/**
 * Gemini Streaming Integration for AI Chat
 * 
 * Provides real-time streaming responses using Google's Gemini API
 * with Server-Sent Events (SSE) for the frontend.
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Initialize the Gemini client with API key from environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Model configuration - using Gemini 2.0 Flash (latest fast model)
const MODEL_NAME = 'gemini-2.0-flash';

// Safety settings - allow all content for business analysis
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

// Generation config optimized for chat
const generationConfig = {
  temperature: 0.7,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 2048,
};

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamingChatOptions {
  messages: ChatMessage[];
  systemPrompt?: string;
  onChunk: (chunk: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

/**
 * Build chat history in Gemini format
 */
function buildChatHistory(messages: ChatMessage[], systemPrompt?: string) {
  const history: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  
  // Add system prompt as the first user message if provided
  if (systemPrompt) {
    history.push({
      role: 'user',
      parts: [{ text: `System Instructions: ${systemPrompt}\n\nPlease acknowledge you understand these instructions and will follow them.` }],
    });
    history.push({
      role: 'model',
      parts: [{ text: 'I understand and will follow these instructions. I am Coach Inayah\'s AI assistant, trained on rental arbitrage methodology and ready to help with property analysis.' }],
    });
  }

  // Convert messages to Gemini format
  for (const msg of messages) {
    if (msg.role === 'system') {
      // System messages become user messages with context
      history.push({
        role: 'user',
        parts: [{ text: `Context: ${msg.content}` }],
      });
      history.push({
        role: 'model',
        parts: [{ text: 'I\'ve noted this context and will use it in my responses.' }],
      });
    } else if (msg.role === 'user') {
      history.push({
        role: 'user',
        parts: [{ text: msg.content }],
      });
    } else if (msg.role === 'assistant') {
      history.push({
        role: 'model',
        parts: [{ text: msg.content }],
      });
    }
  }

  return history;
}

/**
 * Stream a chat response from Gemini
 */
export async function streamGeminiChat(options: StreamingChatOptions): Promise<void> {
  const { messages, systemPrompt, onChunk, onComplete, onError } = options;
  
  try {
    // Get the model
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings,
      generationConfig,
    });

    // Build the conversation history
    const history = buildChatHistory(messages, systemPrompt);
    
    // The last message should be from the user
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    
    if (!lastUserMessage) {
      throw new Error('No user message found in conversation');
    }

    // Start a chat session with history (excluding the last user message)
    const chatHistory = history.slice(0, -1);
    
    const chat = model.startChat({
      history: chatHistory.length > 0 ? chatHistory : undefined,
    });

    // Send the message and stream the response
    const result = await chat.sendMessageStream(lastUserMessage.content);
    
    let fullResponse = '';
    
    // Process the stream
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullResponse += chunkText;
        onChunk(chunkText);
      }
    }
    
    // Call onComplete with the full response
    onComplete(fullResponse);
    
  } catch (error) {
    console.error('[Gemini Streaming] Error:', error);
    onError(error instanceof Error ? error : new Error('Unknown streaming error'));
  }
}

/**
 * Non-streaming chat for fallback
 */
export async function geminiChat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings,
      generationConfig,
    });

    const history = buildChatHistory(messages, systemPrompt);
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    
    if (!lastUserMessage) {
      throw new Error('No user message found in conversation');
    }

    const chatHistory = history.slice(0, -1);
    
    const chat = model.startChat({
      history: chatHistory.length > 0 ? chatHistory : undefined,
    });

    const result = await chat.sendMessage(lastUserMessage.content);
    return result.response.text();
    
  } catch (error) {
    console.error('[Gemini Chat] Error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return 'I apologize, but I\'m having trouble connecting to my AI service. Please try again in a moment.';
      }
      if (error.message.includes('quota') || error.message.includes('rate')) {
        return 'I\'m receiving a lot of questions right now. Please wait a moment and try again.';
      }
    }
    
    return 'I apologize, but I encountered an error processing your question. Please try rephrasing or ask something else.';
  }
}

/**
 * Check if Gemini API is configured and working
 */
export async function checkGeminiHealth(): Promise<boolean> {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });
    const result = await model.generateContent('Say "OK" if you can hear me.');
    return result.response.text().toLowerCase().includes('ok');
  } catch {
    return false;
  }
}
