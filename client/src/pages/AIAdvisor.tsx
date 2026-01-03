/**
 * AI Investment Advisor - Dynamic Data Fetching
 * 
 * This component uses Gemini function calling to dynamically fetch
 * market data based on user questions. No pre-loaded data needed.
 */

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
  Zap,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const suggestedQuestions = [
  "Is Austin better than Nashville for investing?",
  "What's the average revenue in Miami?",
  "Compare Denver and Seattle for a 3BR investment",
  "Show me the top performers in Phoenix",
  "What's the seasonality like in San Diego?",
  "Which market has the best occupancy rates?",
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
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none text-[#0F172A] prose-headings:text-[#0F172A] prose-strong:text-[#0F172A] prose-li:marker:text-[#C9A962]">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
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
      // The backend now handles dynamic data fetching via Gemini function calling
      // No need to pass market context - it fetches fresh data for any market asked about
      const result = await advisorMutation.mutateAsync({
        question: messageText,
        conversationHistory: messages,
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
      console.error('AI Advisor error:', error);
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
              <p className="text-white/60 text-sm">Real-time market data • Any market • Any question</p>
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
              Ask me about any STR market
            </h2>
            <p className="text-[#0F172A]/60 max-w-md mb-4">
              I fetch real-time market data for any market you ask about. 
              Compare cities, analyze revenue, understand seasonality.
            </p>
            
            {/* Data Source Badge */}
            <div className="inline-flex items-center gap-2 bg-[#0F172A]/5 px-4 py-2 rounded-full mb-8">
              <Database className="w-4 h-4 text-[#C9A962]" />
              <span className="text-sm text-[#0F172A]/70">Powered by Coach Inayah</span>
            </div>
            
            <p className="text-sm text-[#0F172A]/40 mb-4">Try asking:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSend(question)}
                  className="text-left px-4 py-3 rounded-xl border-2 border-dashed border-[#C9A962]/30 hover:border-[#C9A962] hover:bg-[#C9A962]/5 transition-all duration-200 text-sm text-[#0F172A]/70 hover:text-[#0F172A]"
                >
                  {question}
                </button>
              ))}
            </div>
            
            {/* Feature Cards */}
            <div className="grid grid-cols-3 gap-4 mt-10 max-w-xl">
              <div className="text-center p-4">
                <div className="w-10 h-10 rounded-lg bg-[#C9A962]/10 flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="w-5 h-5 text-[#C9A962]" />
                </div>
                <p className="text-xs font-medium text-[#0F172A]">Market Comparison</p>
                <p className="text-xs text-[#0F172A]/50">Compare any markets</p>
              </div>
              <div className="text-center p-4">
                <div className="w-10 h-10 rounded-lg bg-[#C9A962]/10 flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="w-5 h-5 text-[#C9A962]" />
                </div>
                <p className="text-xs font-medium text-[#0F172A]">Live Data</p>
                <p className="text-xs text-[#0F172A]/50">Fresh market stats</p>
              </div>
              <div className="text-center p-4">
                <div className="w-10 h-10 rounded-lg bg-[#C9A962]/10 flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-5 h-5 text-[#C9A962]" />
                </div>
                <p className="text-xs font-medium text-[#0F172A]">Instant Insights</p>
                <p className="text-xs text-[#0F172A]/50">Get answers fast</p>
              </div>
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="flex-1 space-y-4 overflow-y-auto pb-4">
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
                    <span className="text-sm">Fetching market data...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-[#0F172A]/10 pt-4 mt-auto">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about any market, compare cities, or get investment insights..."
              className="flex-1 border-2 border-[#0F172A]/10 focus:border-[#C9A962] rounded-xl py-3 px-4"
              disabled={isLoading}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="bg-[#C9A962] hover:bg-[#b8994f] text-white rounded-xl px-4"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-center text-[#0F172A]/40 mt-3">
            Data sourced in real-time • Results may take a moment to fetch
          </p>
        </div>
      </div>
    </div>
  );
}
