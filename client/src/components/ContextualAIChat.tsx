import { useState, useRef, useEffect, useCallback } from 'react';
import { useStreamingChat } from '@/hooks/useStreamingChat';
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
  RotateCcw,
  Database,
  MapPin,
  TrendingUp,
  Home,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { LightMarkdown } from '@/components/LightMarkdown';
import { trpc } from '@/lib/trpc';
import {
  COACH_INAYAH_METHODOLOGY,
  TOOL_DOCUMENTATION,
  FAQ_KNOWLEDGE,
  AI_SYSTEM_PROMPT,
  SUGGESTED_QUESTIONS,
} from '@/data/knowledgeBase';
import { useReportMode } from '@/contexts/ReportModeContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Expanded interfaces for live data
interface MonthlyForecast {
  month: string;
  revenue: number;
  adr: number;
  occupancy: number;
}

interface CompProperty {
  title?: string;
  bedrooms?: number;
  bathrooms?: number;
  rating?: number;
  reviews?: number;
  annualRevenue?: number;
  adr?: number;
  occupancy?: number;
  distance?: number;
}

interface LivePropertyData {
  address?: string;
  bedrooms?: number;
  bathrooms?: number;
  accommodates?: number;
  monthlyRent?: number;
  // Revenue estimates
  projectedRevenue?: number;
  revenueRangeLow?: number;
  revenueRangeHigh?: number;
  averageDailyRate?: number;
  occupancyRate?: number;
  revPAR?: number;
  // Profitability
  profitMargin?: number;
  monthlyProfit?: number;
  annualProfit?: number;
  // Monthly forecast
  monthlyForecast?: MonthlyForecast[];
  // Comparable properties
  comparableProperties?: CompProperty[];
  // Analysis timestamp
  analyzedAt?: Date;
}

interface LiveMarketData {
  city?: string;
  state?: string;
  marketName?: string;
  // Market stats
  averageRevenue?: number;
  medianRevenue?: number;
  averageOccupancy?: number;
  averageADR?: number;
  revPAR?: number;
  // Supply/demand
  totalActiveListings?: number;
  newListingsLast30Days?: number;
  listingsRemovedLast30Days?: number;
  // Market trends
  revenueGrowthYoY?: number;
  occupancyChangeYoY?: number;
  adrChangeYoY?: number;
  // Seasonality
  peakSeason?: string;
  lowSeason?: string;
  seasonalityIndex?: number;
  // Analysis timestamp
  analyzedAt?: Date;
}

interface PageContext {
  currentTool?: string;
  propertyData?: LivePropertyData;
  marketData?: LiveMarketData;
}

interface ContextualAIChatProps {
  pageContext?: PageContext;
  className?: string;
}

export function ContextualAIChat({ pageContext, className = '' }: ContextualAIChatProps) {
  const { mode: reportMode } = useReportMode();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDataContext, setShowDataContext] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get the AI chat mutation (fallback)
  const chatMutation = trpc.ai?.chat?.useMutation?.() || null;
  
  // Streaming chat hook
  const { sendMessage: sendStreamingMessage, isStreaming, streamedContent, cancelStream } = useStreamingChat();
  
  // Track the streaming message ID
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // Check if we have live data
  const hasPropertyData = !!(pageContext?.propertyData?.address || pageContext?.propertyData?.projectedRevenue);
  const hasMarketData = !!(pageContext?.marketData?.city || pageContext?.marketData?.averageRevenue);
  const hasLiveData = hasPropertyData || hasMarketData;

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

  // Build comprehensive context string from live data
  const buildContextString = useCallback(() => {
    const parts: string[] = [];

    if (pageContext?.currentTool) {
      parts.push(`Current tool: ${pageContext.currentTool}`);
    }

    // Property data with full details
    if (pageContext?.propertyData) {
      const p = pageContext.propertyData;
      parts.push(`\n=== LIVE PROPERTY ANALYSIS DATA ===`);
      
      if (p.address) parts.push(`Property Address: ${p.address}`);
      if (p.bedrooms) parts.push(`Bedrooms: ${p.bedrooms}`);
      if (p.bathrooms) parts.push(`Bathrooms: ${p.bathrooms}`);
      if (p.accommodates) parts.push(`Accommodates: ${p.accommodates} guests`);
      if (p.monthlyRent) parts.push(`Monthly Rent: $${p.monthlyRent.toLocaleString()}`);
      
      // Revenue estimates
      if (p.projectedRevenue) {
        parts.push(`\nRevenue Projections:`);
        parts.push(`- Projected Annual Revenue: $${p.projectedRevenue.toLocaleString()}`);
        if (p.revenueRangeLow && p.revenueRangeHigh) {
          parts.push(`- Revenue Range: $${p.revenueRangeLow.toLocaleString()} - $${p.revenueRangeHigh.toLocaleString()}`);
        }
        if (p.averageDailyRate) parts.push(`- Average Daily Rate (ADR): $${p.averageDailyRate}`);
        if (p.occupancyRate) parts.push(`- Occupancy Rate: ${(p.occupancyRate * 100).toFixed(1)}%`);
        if (p.revPAR) parts.push(`- RevPAR: $${p.revPAR.toFixed(0)}`);
      }
      
      // Profitability
      if (p.profitMargin !== undefined || p.monthlyProfit !== undefined) {
        parts.push(`\nProfitability:`);
        if (p.monthlyProfit) parts.push(`- Monthly Profit: $${p.monthlyProfit.toLocaleString()}`);
        if (p.annualProfit) parts.push(`- Annual Profit: $${p.annualProfit.toLocaleString()}`);
        if (p.profitMargin !== undefined) parts.push(`- Profit Margin: ${p.profitMargin.toFixed(1)}%`);
      }
      
      // Monthly forecast
      if (p.monthlyForecast && p.monthlyForecast.length > 0) {
        parts.push(`\nMonthly Revenue Forecast:`);
        p.monthlyForecast.forEach(m => {
          parts.push(`- ${m.month}: $${m.revenue.toLocaleString()} (ADR: $${m.adr}, Occ: ${(m.occupancy * 100).toFixed(0)}%)`);
        });
      }
      
      // Comparable properties
      if (p.comparableProperties && p.comparableProperties.length > 0) {
        parts.push(`\nComparable Properties (${p.comparableProperties.length} comps):`);
        p.comparableProperties.slice(0, 5).forEach((comp, i) => {
          const compInfo = [
            comp.title || `Comp ${i + 1}`,
            comp.bedrooms ? `${comp.bedrooms}BR` : '',
            comp.annualRevenue ? `$${comp.annualRevenue.toLocaleString()}/yr` : '',
            comp.occupancy ? `${(comp.occupancy * 100).toFixed(0)}% occ` : '',
            comp.rating ? `${comp.rating}★` : '',
          ].filter(Boolean).join(' | ');
          parts.push(`- ${compInfo}`);
        });
      }
      
      if (p.analyzedAt) {
        parts.push(`\nData freshness: Analyzed ${new Date(p.analyzedAt).toLocaleString()}`);
      }
    }

    // Market data with full details
    if (pageContext?.marketData) {
      const m = pageContext.marketData;
      parts.push(`\n=== LIVE MARKET RESEARCH DATA ===`);
      
      if (m.marketName) parts.push(`Market: ${m.marketName}`);
      else if (m.city && m.state) parts.push(`Location: ${m.city}, ${m.state}`);
      
      // Market stats
      if (m.averageRevenue || m.medianRevenue) {
        parts.push(`\nMarket Performance:`);
        if (m.averageRevenue) parts.push(`- Average Annual Revenue: $${m.averageRevenue.toLocaleString()}`);
        if (m.medianRevenue) parts.push(`- Median Annual Revenue: $${m.medianRevenue.toLocaleString()}`);
        if (m.averageOccupancy) parts.push(`- Average Occupancy: ${(m.averageOccupancy * 100).toFixed(1)}%`);
        if (m.averageADR) parts.push(`- Average Daily Rate: $${m.averageADR}`);
        if (m.revPAR) parts.push(`- RevPAR: $${m.revPAR.toFixed(0)}`);
      }
      
      // Supply/demand
      if (m.totalActiveListings) {
        parts.push(`\nSupply & Demand:`);
        parts.push(`- Total Active Listings: ${m.totalActiveListings.toLocaleString()}`);
        if (m.newListingsLast30Days) parts.push(`- New Listings (30 days): ${m.newListingsLast30Days}`);
        if (m.listingsRemovedLast30Days) parts.push(`- Listings Removed (30 days): ${m.listingsRemovedLast30Days}`);
      }
      
      // Market trends
      if (m.revenueGrowthYoY !== undefined || m.occupancyChangeYoY !== undefined) {
        parts.push(`\nYear-over-Year Trends:`);
        if (m.revenueGrowthYoY !== undefined) parts.push(`- Revenue Growth: ${m.revenueGrowthYoY > 0 ? '+' : ''}${m.revenueGrowthYoY.toFixed(1)}%`);
        if (m.occupancyChangeYoY !== undefined) parts.push(`- Occupancy Change: ${m.occupancyChangeYoY > 0 ? '+' : ''}${m.occupancyChangeYoY.toFixed(1)}%`);
        if (m.adrChangeYoY !== undefined) parts.push(`- ADR Change: ${m.adrChangeYoY > 0 ? '+' : ''}${m.adrChangeYoY.toFixed(1)}%`);
      }
      
      // Seasonality
      if (m.peakSeason || m.lowSeason) {
        parts.push(`\nSeasonality:`);
        if (m.peakSeason) parts.push(`- Peak Season: ${m.peakSeason}`);
        if (m.lowSeason) parts.push(`- Low Season: ${m.lowSeason}`);
        if (m.seasonalityIndex) parts.push(`- Seasonality Index: ${m.seasonalityIndex.toFixed(2)}`);
      }
      
      if (m.analyzedAt) {
        parts.push(`\nData freshness: Analyzed ${new Date(m.analyzedAt).toLocaleString()}`);
      }
    }

    return parts.join('\n');
  }, [pageContext]);

  // Update streaming message content in real-time
  useEffect(() => {
    if (streamingMessageId && streamedContent) {
      setMessages(prev => prev.map(m => 
        m.id === streamingMessageId 
          ? { ...m, content: streamedContent }
          : m
      ));
    }
  }, [streamedContent, streamingMessageId]);

  // Handle sending a message with streaming
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || isStreaming) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    // Create placeholder for streaming response
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setStreamingMessageId(assistantMessageId);
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

      // Build conversation history (excluding the new messages we just added)
      const conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Enhanced system prompt when live data is available
      const modeInstruction = reportMode === 'pro'
        ? `\n\nIMPORTANT MODE: The user is in PRO MODE. Use precise financial terminology, include exact numbers and percentages, reference market benchmarks, and write in a data-dense investor-grade style. Avoid over-explaining basic concepts.`
        : `\n\nIMPORTANT MODE: The user is in GUIDED MODE. Use plain language with context and analogies. Explain industry terms when you use them. Break down complex concepts step by step. This user may be newer to short-term rental investing.`;

      const enhancedSystemPrompt = hasLiveData
        ? `${AI_SYSTEM_PROMPT}${modeInstruction}

IMPORTANT: You have access to LIVE DATA from the user's current analysis. When answering questions:
1. Reference specific numbers from the live data (revenue, occupancy, ADR, etc.)
2. Compare the property/market to benchmarks from your knowledge base
3. Provide actionable insights based on the actual data
4. Be specific - mention exact figures like "$85,000 annual revenue" not just "good revenue"
5. If the user asks about their property or market, use the live data to give personalized answers`
        : `${AI_SYSTEM_PROMPT}${modeInstruction}`;

      // Build full message array for streaming
      const fullMessages = [
        { role: 'system' as const, content: enhancedSystemPrompt },
        { role: 'system' as const, content: `Knowledge Base:\n${knowledgeContext}` },
        ...(contextString ? [{ role: 'system' as const, content: `Current Page Context:\n${contextString}` }] : []),
        ...conversationHistory,
        { role: 'user' as const, content: input.trim() },
      ];

      // Use streaming endpoint
      await sendStreamingMessage(fullMessages, {
        systemPrompt: enhancedSystemPrompt,
        onComplete: (response) => {
          // Final update with complete response
          setMessages(prev => prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: response }
              : m
          ));
          setStreamingMessageId(null);
        },
        onError: (error) => {
          console.error('Streaming error:', error);
          setMessages(prev => prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: 'I apologize, but I encountered an error. Please try again.' }
              : m
          ));
          setStreamingMessageId(null);
        },
      });
    } catch (error) {
      console.error('AI chat error:', error);
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? { ...m, content: 'I apologize, but I encountered an error. Please try again or rephrase your question.' }
          : m
      ));
      setStreamingMessageId(null);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, isStreaming, messages, buildContextString, sendStreamingMessage, hasLiveData]);

  // Handle suggested question click
  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  // Get suggested questions based on current tool and available data
  const getSuggestedQuestions = () => {
    const baseQuestions = pageContext?.currentTool
      ? SUGGESTED_QUESTIONS[pageContext.currentTool] || SUGGESTED_QUESTIONS.general
      : SUGGESTED_QUESTIONS.general;
    
    // Add data-specific questions if live data is available
    const dataQuestions: string[] = [];
    
    if (hasPropertyData && pageContext?.propertyData) {
      const p = pageContext.propertyData;
      if (p.projectedRevenue) {
        dataQuestions.push(`Is $${p.projectedRevenue.toLocaleString()} good revenue for this property?`);
      }
      if (p.occupancyRate) {
        dataQuestions.push(`How does ${(p.occupancyRate * 100).toFixed(0)}% occupancy compare to the market?`);
      }
      if (p.profitMargin !== undefined) {
        dataQuestions.push(`Is a ${p.profitMargin.toFixed(0)}% profit margin healthy for arbitrage?`);
      }
    }
    
    if (hasMarketData && pageContext?.marketData) {
      const m = pageContext.marketData;
      if (m.city) {
        dataQuestions.push(`What should I know about investing in ${m.city}?`);
      }
      if (m.averageOccupancy) {
        dataQuestions.push(`Is ${(m.averageOccupancy * 100).toFixed(0)}% occupancy typical for this market?`);
      }
    }
    
    // Combine and limit to 4 questions
    return [...dataQuestions, ...baseQuestions].slice(0, 4);
  };

  const suggestedQuestions = getSuggestedQuestions();

  // Clear chat history
  const handleClearChat = () => {
    setMessages([]);
  };

  // Format data context summary
  const getDataContextSummary = () => {
    const items: { icon: React.ReactNode; label: string; value: string }[] = [];
    
    if (pageContext?.propertyData?.address) {
      items.push({
        icon: <Home className="w-3.5 h-3.5" />,
        label: 'Property',
        value: pageContext.propertyData.address.split(',')[0] || 'Analyzing...',
      });
    }
    
    if (pageContext?.propertyData?.projectedRevenue) {
      items.push({
        icon: <TrendingUp className="w-3.5 h-3.5" />,
        label: 'Revenue',
        value: `$${pageContext.propertyData.projectedRevenue.toLocaleString()}/yr`,
      });
    }
    
    if (pageContext?.marketData?.city) {
      items.push({
        icon: <MapPin className="w-3.5 h-3.5" />,
        label: 'Market',
        value: `${pageContext.marketData.city}, ${pageContext.marketData.state || ''}`,
      });
    }
    
    if (pageContext?.marketData?.averageRevenue) {
      items.push({
        icon: <BarChart3 className="w-3.5 h-3.5" />,
        label: 'Avg Revenue',
        value: `$${pageContext.marketData.averageRevenue.toLocaleString()}/yr`,
      });
    }
    
    return items;
  };

  const dataContextItems = getDataContextSummary();

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
            className={`fixed bottom-24 sm:bottom-[4.5rem] right-4 sm:right-6 z-[9998] w-14 h-14 rounded-full bg-gradient-to-br from-[oklch(0.55_0.14_75)] to-[oklch(0.45_0.14_75)] text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center ${className}`}
            aria-label="Open AI Assistant"
          >
            <MessageCircle className="w-6 h-6" />
            {hasLiveData && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                <Database className="w-3 h-3" />
              </span>
            )}
            {!hasLiveData && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
            )}
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
            className={`fixed bottom-24 sm:bottom-[4.5rem] right-4 sm:right-6 z-[9998] w-[calc(100%-2rem)] sm:w-96 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col ${className}`}
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
                  <p className="text-xs text-white/70">
                    {hasLiveData ? 'Analyzing your data' : 'Ask me anything about STR investing'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {hasLiveData && (
                  <button
                    onClick={() => setShowDataContext(!showDataContext)}
                    className={`p-1.5 rounded-full transition-colors ${showDataContext ? 'bg-white/30' : 'hover:bg-white/20'}`}
                    aria-label="Show data context"
                    title="View live data"
                  >
                    <Database className="w-4 h-4" />
                  </button>
                )}
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

            {/* Data Context Panel */}
            <AnimatePresence>
              {showDataContext && hasLiveData && !isMinimized && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-green-50 border-b border-green-100 overflow-hidden"
                >
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-green-800">Live Data Available</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {dataContextItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-1.5 text-xs">
                          <span className="text-green-600">{item.icon}</span>
                          <span className="text-green-700 truncate" title={item.value}>
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                      <h4 className="font-semibold text-gray-900 mb-2">
                        {hasLiveData ? "I'm ready to analyze your data!" : "How can I help you?"}
                      </h4>
                      <p className="text-sm text-gray-500 mb-4">
                        {hasLiveData 
                          ? "Ask me about your property analysis or market research. I have access to your live data."
                          : "I'm trained on Coach Inayah's methodology and can help you analyze properties."
                        }
                      </p>
                      
                      {/* Live Data Badge */}
                      {hasLiveData && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-medium mb-4">
                          <Database className="w-3.5 h-3.5" />
                          Live data connected
                        </div>
                      )}
                      
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
                              <LightMarkdown>{message.content}</LightMarkdown>
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
                      placeholder={hasLiveData ? "Ask about your analysis..." : "Ask about STR investing..."}
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
                    {hasLiveData 
                      ? "Responses include your live analysis data"
                      : "AI responses are based on Coach Inayah's methodology"
                    }
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
