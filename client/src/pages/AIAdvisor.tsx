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
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const suggestedQuestions = [
  "Is Austin better than Nashville for a 3BR investment?",
  "What markets have the best ROI for beginners?",
  "How do I evaluate seasonality risk?",
  "What's the difference between ADR and RevPAR?",
  "Which coastal markets have the best regulations?",
  "How much should I budget for my first STR?",
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

  // Fetch some market data for context
  const { data: marketsData } = trpc.advanced.getCountryMarkets.useQuery({
    countryCode: 'us',
    limit: 20,
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
      // Prepare market context
      const marketContext = marketsData?.data?.markets ? {
        markets: marketsData.data.markets.slice(0, 10).map(m => ({
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
              <h1 className="text-2xl font-serif font-semibold">AI Investment Advisor</h1>
              <p className="text-white/60 text-sm">Ask me anything about STR markets and investments</p>
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
            <h2 className="text-2xl font-serif font-semibold text-[#0F172A] mb-2">
              How can I help you today?
            </h2>
            <p className="text-[#0F172A]/60 max-w-md mb-8">
              I'm your AI-powered short-term rental investment advisor. Ask me about markets, 
              ROI calculations, pricing strategies, or anything else related to STR investing.
            </p>

            {/* Suggested Questions */}
            <div className="w-full max-w-2xl">
              <p className="text-sm text-[#0F172A]/50 mb-3 flex items-center justify-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Try asking:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSend(question)}
                    className="text-left p-3 bg-white border border-[#0F172A]/10 rounded-lg hover:border-[#C9A962] hover:shadow-sm transition-all text-sm text-[#0F172A]/80"
                  >
                    <MessageSquare className="w-4 h-4 inline-block mr-2 text-[#C9A962]" />
                    {question}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 w-full max-w-2xl">
              <Card className="bg-white/50">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <h3 className="font-medium text-[#0F172A] text-sm">Market Analysis</h3>
                  <p className="text-xs text-[#0F172A]/60">Compare markets and find opportunities</p>
                </CardContent>
              </Card>
              <Card className="bg-white/50">
                <CardContent className="p-4 text-center">
                  <MapPin className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <h3 className="font-medium text-[#0F172A] text-sm">Location Insights</h3>
                  <p className="text-xs text-[#0F172A]/60">Get data on 500+ US markets</p>
                </CardContent>
              </Card>
              <Card className="bg-white/50">
                <CardContent className="p-4 text-center">
                  <Sparkles className="w-6 h-6 mx-auto mb-2 text-[#C9A962]" />
                  <h3 className="font-medium text-[#0F172A] text-sm">Expert Advice</h3>
                  <p className="text-xs text-[#0F172A]/60">Personalized recommendations</p>
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
                    <span className="text-sm">Thinking...</span>
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
              placeholder="Ask about markets, ROI, pricing strategies..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1 bg-white"
            />
            <Button 
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="bg-[#C9A962] hover:bg-[#b89a55] text-white px-6"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-[#0F172A]/40 text-center mt-2">
            AI responses are for informational purposes only. Always do your own research before investing.
          </p>
        </div>
      </div>
    </div>
  );
}
