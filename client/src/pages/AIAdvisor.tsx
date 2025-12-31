'use client';

import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { 
  ArrowLeft, 
  Bot,
  Send,
  User,
  Loader2,
  Sparkles,
  TrendingUp,
  MapPin,
  BarChart3,
  DollarSign,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const suggestedQuestions = [
  "Is Austin better than Nashville for investing?",
  "Which markets have the highest ROI potential?",
  "Tell me about Miami's rental market",
  "How does seasonality affect my revenue?",
  "What's the best market for beginners?",
  "Compare Denver and Boulder for me",
];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-[#0F172A]' : 'bg-[#C9A962]'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        isUser 
          ? 'bg-[#0F172A] text-white rounded-tr-sm' 
          : 'bg-white border border-[#0F172A]/10 text-[#0F172A] rounded-tl-sm shadow-sm'
      }`}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}

export default function AIAdvisor() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const advisorMutation = trpc.advanced.getInvestmentAdvice.useMutation();

  // Fetch market data for context - this will be automatically used by the advisor
  const { data: marketsData } = trpc.advanced.getCountryMarkets.useQuery({
    countryCode: 'us',
    limit: 50,
    sort_by: 'market_score',
    sort_direction: 'desc',
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (question?: string) => {
    const messageText = question || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare market context - AI will use this data to answer questions
      const marketContext = marketsData?.data?.markets ? {
        markets: marketsData.data.markets.slice(0, 50).map(m => ({
          name: m.name,
          scores: m.scores,
          metrics: m.metrics,
          listing_count: m.listing_count,
        })),
      } : undefined;

      const result = await advisorMutation.mutateAsync({
        question: messageText,
        conversationHistory: messages,
        marketContext,
      });

      if (result.success && result.data?.response) {
        const assistantMessage: ChatMessage = { 
          role: 'assistant', 
          content: result.data.response 
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessage = { 
          role: 'assistant', 
          content: "I apologize, but I couldn't process your question. Please try again." 
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = { 
        role: 'assistant', 
        content: "I'm having trouble connecting right now. Please try again in a moment." 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex flex-col">
      {/* Header */}
      <div className="bg-[#0F172A] text-white py-4 px-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C9A962] to-[#a88b4a] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-semibold">STR Investment Advisor</h1>
              <p className="text-white/60 text-sm">AI-powered market analysis powered by real AirDNA data</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#C9A962] to-[#a88b4a] flex items-center justify-center mb-6">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-3xl font-serif font-semibold text-[#0F172A] mb-2">
              Ask me anything about STR markets
            </h2>
            <p className="text-[#0F172A]/60 max-w-md mb-8">
              I analyze real AirDNA data to help you make smarter investment decisions. 
              Compare markets, understand trends, and find your next opportunity.
            </p>

            {/* Suggested Questions */}
            <div className="w-full max-w-2xl mb-8">
              <p className="text-sm text-[#0F172A]/50 mb-3 font-medium">Try asking:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSend(question)}
                    className="text-left p-3 bg-white border border-[#0F172A]/10 rounded-lg hover:border-[#C9A962] hover:shadow-md hover:bg-[#FAF9F6] transition-all text-sm text-[#0F172A]/80 font-medium"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>

            {/* Capabilities */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
              <Card className="bg-white/50 border-[#0F172A]/10">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 mx-auto mb-2 text-[#C9A962]" />
                  <h3 className="font-medium text-[#0F172A] text-sm">Market Comparison</h3>
                  <p className="text-xs text-[#0F172A]/60 mt-1">Compare any markets side-by-side</p>
                </CardContent>
              </Card>
              <Card className="bg-white/50 border-[#0F172A]/10">
                <CardContent className="p-4 text-center">
                  <BarChart3 className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <h3 className="font-medium text-[#0F172A] text-sm">Real Data</h3>
                  <p className="text-xs text-[#0F172A]/60 mt-1">500+ US markets analyzed</p>
                </CardContent>
              </Card>
              <Card className="bg-white/50 border-[#0F172A]/10">
                <CardContent className="p-4 text-center">
                  <Zap className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
                  <h3 className="font-medium text-[#0F172A] text-sm">Instant Insights</h3>
                  <p className="text-xs text-[#0F172A]/60 mt-1">Get answers in seconds</p>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Chat Messages */
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {messages.map((message, index) => (
              <MessageBubble key={index} message={message} />
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#C9A962] flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-[#0F172A]/10 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-[#0F172A]/60">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing markets...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area */}
        <div className="sticky bottom-0 bg-[#FAF9F6] pt-4 border-t border-[#0F172A]/10">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about markets, ROI, seasonality, or anything STR-related..."
              disabled={isLoading}
              className="flex-1 rounded-full border-[#0F172A]/20 focus:border-[#C9A962] focus:ring-[#C9A962]/20"
            />
            <Button
              onClick={() => handleSend()}
              disabled={isLoading || !input.trim()}
              className="rounded-full bg-[#C9A962] hover:bg-[#a88b4a] text-white px-6"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
