/**
 * PropertyChatBot — Property-specific AI chatbot for Step 5 (TeslaDashboard)
 * 
 * A slide-out chat panel powered by Gemini Flash that answers questions
 * exclusively about the property being analyzed. Matches the user's
 * selected tone (Pro = investor-grade, Guided = beginner-friendly).
 * 
 * Design: Floating button bottom-left → slide-out panel with chat history.
 * Uses the same SSE streaming pattern as the existing AI chat.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  MessageCircle, 
  Send, 
  X, 
  Loader2, 
  Bot,
  User,
  RotateCcw,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LightMarkdown } from '@/components/LightMarkdown';
import { useReportMode } from '@/contexts/ReportModeContext';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PropertyChatContext {
  address: string;
  bedrooms: number;
  bathrooms: number;
  accommodates?: number;
  monthlyRent?: number;
  projectedRevenue: number;
  revenueLow: number;
  revenueHigh: number;
  adr: number;
  occupancyRate: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  revenueScenarios?: {
    conservative: number;
    target: number;
    optimistic: number;
    compCount: number;
  };
  forecast?: Array<{
    month: string;
    revenue: number;
    adr: number;
    occupancy: number;
  }>;
  comparables?: Array<{
    title?: string;
    bedrooms?: number;
    bathrooms?: number;
    rating?: number;
    reviews?: number;
    annualRevenue?: number;
    adr?: number;
    occupancy?: number;
    distance?: number;
  }>;
  historicalTrend?: string;
  yearlyPctChange?: number;
  marketInsights?: {
    professionallyManagedPct?: number;
    superhostPct?: number;
    avgRating?: number;
    totalListings?: number;
    marketScore?: number;
  };
  rentometer?: {
    median: number;
    mean?: number;
    min: number;
    max: number;
    sampleCount: number;
    radiusMiles?: number;
    stdDev?: number;
    userRentVsMarket: string;
    rentAdvantage: number;
    percentileRank: number;
  };
  mode?: 'rent' | 'purchase';
  purchasePrice?: number;
}

interface PropertyChatBotProps {
  propertyContext: PropertyChatContext;
}

// ---------------------------------------------------------------------------
// SUGGESTED QUESTIONS
// ---------------------------------------------------------------------------

const SUGGESTED_QUESTIONS_PRO = [
  "What's the cap rate and CoC return for this property?",
  "How does this property compare to the comps?",
  "What are the peak and off-season revenue projections?",
  "Is this property overpriced based on the data?",
];

const SUGGESTED_QUESTIONS_GUIDED = [
  "Is this a good deal for a beginner?",
  "How much money would I actually take home each month?",
  "What months will be the slowest for bookings?",
  "What should I know before investing in this property?",
];

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export function PropertyChatBot({ propertyContext }: PropertyChatBotProps) {
  const { mode: reportMode } = useReportMode();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = useMemo(
    () => reportMode === 'pro' ? SUGGESTED_QUESTIONS_PRO : SUGGESTED_QUESTIONS_GUIDED,
    [reportMode]
  );

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Track scroll position to show/hide scroll button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  // Stream a message via SSE
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    };

    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setStreamingMessageId(assistantMessageId);
    setInput('');
    setIsStreaming(true);

    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Build conversation history for the API (excluding the placeholder)
      const conversationMessages = [
        ...messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user' as const, content: messageText.trim() },
      ];

      const response = await fetch('/api/ai/property-chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyContext,
          reportMode,
          messages: conversationMessages,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                fullResponse += data.content;
                setMessages(prev => prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: fullResponse }
                    : m
                ));
              } else if (data.type === 'complete') {
                fullResponse = data.content;
                setMessages(prev => prev.map(m =>
                  m.id === assistantMessageId
                    ? { ...m, content: fullResponse }
                    : m
                ));
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (parseError) {
              if (parseError instanceof SyntaxError) continue;
              throw parseError;
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('[PropertyChat] Error:', error);
      setMessages(prev => prev.map(m =>
        m.id === assistantMessageId
          ? { ...m, content: 'I apologize, but I encountered an error. Please try again.' }
          : m
      ));
    } finally {
      setIsStreaming(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  }, [isStreaming, messages, propertyContext, reportMode]);

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleReset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    setIsStreaming(false);
    setStreamingMessageId(null);
  }, []);

  const handleSuggestedQuestion = useCallback((question: string) => {
    sendMessage(question);
  }, [sendMessage]);

  // Format the address for display
  const shortAddress = propertyContext.address.split(',')[0] || propertyContext.address;

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-20 left-4 sm:bottom-24 sm:left-6 z-[9996] group"
            aria-label="Ask about this property"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0F172A] to-[#1e293b] shadow-lg flex items-center justify-center border-2 border-[#C9A962]/40 group-hover:border-[#C9A962] transition-all duration-300 group-hover:shadow-xl group-hover:shadow-[#C9A962]/20">
                <MessageCircle className="w-6 h-6 text-[#C9A962]" />
              </div>
              {/* Pulse indicator */}
              {messages.length === 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C9A962] opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-[#C9A962]" />
                </span>
              )}
            </div>
            {/* Tooltip */}
            <div className="absolute left-16 bottom-2 whitespace-nowrap bg-[#0F172A] text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
              Ask about this property
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-[9996] w-[calc(100vw-2rem)] sm:w-[420px] h-[min(600px,calc(100vh-6rem))] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0F172A] to-[#1e293b] text-white flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#C9A962]/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-[#C9A962]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate">Property Assistant</h3>
                  <p className="text-xs text-white/60 truncate">{shortAddress}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="Reset conversation"
                >
                  <RotateCcw className="w-4 h-4 text-white/70" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="Close chat"
                >
                  <X className="w-4 h-4 text-white/70" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-slate-50/50 relative"
            >
              {/* Welcome message when empty */}
              {messages.length === 0 && (
                <div className="space-y-4">
                  {/* Welcome card */}
                  <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="w-5 h-5 text-[#C9A962]" />
                      <span className="text-sm font-semibold text-slate-800">
                        {reportMode === 'pro' ? 'Investment Analyst' : "Coach Inayah's Assistant"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {reportMode === 'pro'
                        ? `I have the complete analysis data for ${shortAddress}. Ask me about revenue projections, cap rates, comp analysis, seasonality, or any investment metric.`
                        : `Hi! I'm here to help you understand the numbers for ${shortAddress}. Ask me anything — I'll explain it in plain English!`
                      }
                    </p>
                  </div>

                  {/* Suggested questions */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-1">
                      Try asking
                    </p>
                    {suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestedQuestion(q)}
                        className="w-full text-left px-3 py-2.5 rounded-lg bg-white border border-slate-100 text-sm text-slate-700 hover:bg-[#0F172A]/5 hover:border-[#C9A962]/30 transition-all duration-200 shadow-sm"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat messages */}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0F172A] to-[#1e293b] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-[#C9A962]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                      message.role === 'user'
                        ? 'bg-[#0F172A] text-white rounded-br-md'
                        : 'bg-white border border-slate-100 shadow-sm rounded-bl-md'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      message.content ? (
                        <div className="text-sm text-slate-700 prose prose-sm max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:mt-3 prose-headings:mb-1.5">
                          <LightMarkdown>{message.content}</LightMarkdown>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-1">
                          <Loader2 className="w-4 h-4 animate-spin text-[#C9A962]" />
                          <span className="text-sm text-slate-400">Thinking...</span>
                        </div>
                      )
                    ) : (
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom button */}
            <AnimatePresence>
              {showScrollButton && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  onClick={scrollToBottom}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Input Area */}
            <div className="px-3 py-3 bg-white border-t border-slate-100 flex-shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={reportMode === 'pro' ? 'Ask about investment metrics...' : 'Ask me anything about this property...'}
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A962]/30 focus:border-[#C9A962] placeholder:text-slate-400 max-h-24 bg-slate-50"
                  style={{ minHeight: '40px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 96) + 'px';
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  size="icon"
                  className="h-10 w-10 rounded-xl bg-[#0F172A] hover:bg-[#1e293b] disabled:opacity-40 flex-shrink-0"
                >
                  {isStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                Powered by Gemini · Answers based on your property data
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default PropertyChatBot;
