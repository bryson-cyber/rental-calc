import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageCircle, 
  Send, 
  X, 
  Sparkles,
  Loader2,
  ChevronDown,
  Lightbulb,
  User,
  Bot,
  Minimize2,
  Maximize2,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Streamdown } from 'streamdown';
import { trpc } from '@/lib/trpc';
import {
  COACH_INAYAH_METHODOLOGY,
  TOOL_DOCUMENTATION,
  FAQ_KNOWLEDGE,
  AI_SYSTEM_PROMPT,
  SUGGESTED_QUESTIONS,
} from '@/data/knowledgeBase';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PageContext {
  currentTool?: string;
  propertyData?: {
    address?: string;
    bedrooms?: number;
    bathrooms?: number;
    monthlyRent?: number;
    projectedRevenue?: number;
    profitMargin?: number;
    occupancyRate?: number;
  };
  marketData?: {
    city?: string;
    state?: string;
    averageRevenue?: number;
    averageOccupancy?: number;
    averageADR?: number;
  };
}

interface ContextualAIChatProps {
  pageContext?: PageContext;
  className?: string;
}

export function ContextualAIChat({ pageContext, className = '' }: ContextualAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get the AI chat mutation
  const chatMutation = trpc.ai?.chat?.useMutation?.() || null;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Build context string from page data
  const buildContextString = useCallback(() => {
    const parts: string[] = [];

    if (pageContext?.currentTool) {
      parts.push(`Current tool: ${pageContext.currentTool}`);
    }

    if (pageContext?.propertyData) {
      const p = pageContext.propertyData;
      parts.push(`\nProperty being analyzed:`);
      if (p.address) parts.push(`- Address: ${p.address}`);
      if (p.bedrooms) parts.push(`- Bedrooms: ${p.bedrooms}`);
      if (p.bathrooms) parts.push(`- Bathrooms: ${p.bathrooms}`);
      if (p.monthlyRent) parts.push(`- Monthly Rent: $${p.monthlyRent.toLocaleString()}`);
      if (p.projectedRevenue) parts.push(`- Projected Annual Revenue: $${p.projectedRevenue.toLocaleString()}`);
      if (p.profitMargin) parts.push(`- Profit Margin: ${p.profitMargin.toFixed(1)}%`);
      if (p.occupancyRate) parts.push(`- Occupancy Rate: ${(p.occupancyRate * 100).toFixed(0)}%`);
    }

    if (pageContext?.marketData) {
      const m = pageContext.marketData;
      parts.push(`\nMarket being analyzed:`);
      if (m.city && m.state) parts.push(`- Location: ${m.city}, ${m.state}`);
      if (m.averageRevenue) parts.push(`- Average Annual Revenue: $${m.averageRevenue.toLocaleString()}`);
      if (m.averageOccupancy) parts.push(`- Average Occupancy: ${(m.averageOccupancy * 100).toFixed(0)}%`);
      if (m.averageADR) parts.push(`- Average Daily Rate: $${m.averageADR}`);
    }

    return parts.join('\n');
  }, [pageContext]);

  // Handle sending a message
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build the full context for the AI
      const contextString = buildContextString();
      const knowledgeContext = `
${COACH_INAYAH_METHODOLOGY}

${TOOL_DOCUMENTATION}

${FAQ_KNOWLEDGE}
`;

      // Build conversation history
      const conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Call the AI endpoint
      if (chatMutation) {
        const response = await chatMutation.mutateAsync({
          messages: [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            { role: 'system', content: `Knowledge Base:\n${knowledgeContext}` },
            ...(contextString ? [{ role: 'system' as const, content: `Current Page Context:\n${contextString}` }] : []),
            ...conversationHistory,
            { role: 'user', content: input.trim() },
          ],
        });

        const responseContent = typeof response.content === 'string' 
          ? response.content 
          : "I apologize, but I couldn't generate a response. Please try again.";
        
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: responseContent,
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Fallback response if AI endpoint not available
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: "I'm Coach Inayah's AI Assistant! I can help you understand the tools and analyze properties. However, the AI chat feature requires the backend to be configured. Please check with your administrator.",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error('AI chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I apologize, but I encountered an error. Please try again or rephrase your question.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, buildContextString, chatMutation]);

  // Handle suggested question click
  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  // Get suggested questions based on current tool
  const suggestedQuestions = pageContext?.currentTool
    ? SUGGESTED_QUESTIONS[pageContext.currentTool] || SUGGESTED_QUESTIONS.general
    : SUGGESTED_QUESTIONS.general;

  // Clear chat history
  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className={`fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-[80] w-14 h-14 rounded-full bg-gradient-to-br from-[oklch(0.55_0.14_75)] to-[oklch(0.45_0.14_75)] text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center ${className}`}
            aria-label="Open AI Assistant"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? 'auto' : '500px',
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-[80] w-[calc(100%-2rem)] sm:w-96 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col ${className}`}
            style={{ maxHeight: isMinimized ? 'auto' : 'calc(100vh - 120px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[oklch(0.55_0.14_75)] to-[oklch(0.50_0.14_75)] text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Coach Inayah's AI</h3>
                  <p className="text-xs text-white/70">Ask me anything about STR investing</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleClearChat}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                  aria-label={isMinimized ? "Expand" : "Minimize"}
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Content (hidden when minimized) */}
            {!isMinimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-full bg-[oklch(0.55_0.14_75)]/10 flex items-center justify-center mx-auto mb-4">
                        <Bot className="w-8 h-8 text-[oklch(0.55_0.14_75)]" />
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">How can I help you?</h4>
                      <p className="text-sm text-gray-500 mb-4">
                        I'm trained on Coach Inayah's methodology and can help you analyze properties.
                      </p>
                      
                      {/* Suggested Questions */}
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Try asking:</p>
                        {suggestedQuestions.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestedQuestion(question)}
                            className="block w-full text-left px-3 py-2 text-sm text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Lightbulb className="w-3.5 h-3.5 inline mr-2 text-amber-500" />
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-[oklch(0.55_0.14_75)]/10 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            message.role === 'user'
                              ? 'bg-[oklch(0.55_0.14_75)] text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          {message.role === 'assistant' ? (
                            <div className="prose prose-sm max-w-none">
                              <Streamdown>{message.content}</Streamdown>
                            </div>
                          ) : (
                            <p className="text-sm">{message.content}</p>
                          )}
                        </div>
                        {message.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  
                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex gap-2 justify-start">
                      <div className="w-8 h-8 rounded-full bg-[oklch(0.55_0.14_75)]/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-[oklch(0.55_0.14_75)]" />
                      </div>
                      <div className="bg-gray-100 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-gray-100">
                  <div className="flex gap-2">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Ask about STR investing..."
                      className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(0.55_0.14_75)]/50 focus:border-[oklch(0.55_0.14_75)]"
                      rows={1}
                      disabled={isLoading}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      size="icon"
                      className="bg-[oklch(0.55_0.14_75)] hover:bg-[oklch(0.50_0.14_75)] text-white rounded-xl"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    AI responses are based on Coach Inayah's methodology
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
