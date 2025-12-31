/**
 * Smart Home - AI-First Unified Experience
 * 
 * Single smart input that auto-detects:
 * - Property addresses → Property analysis
 * - Zillow URLs → Parse and analyze property
 * - Zip codes → Market analysis
 * - City names → Market analysis
 * - Natural language questions → AI Advisor
 */

import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { 
  Bot,
  Send,
  User,
  Loader2,
  Sparkles,
  Home,
  MapPin,
  Search,
  Building,
  TrendingUp,
  DollarSign,
  BarChart3,
  Zap,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'property_report' | 'market_report';
  data?: unknown;
}

// Input type detection
type InputType = 'zillow_url' | 'zip_code' | 'address' | 'city' | 'question';

function detectInputType(input: string): InputType {
  const trimmed = input.trim().toLowerCase();
  
  // Zillow URL detection
  if (trimmed.includes('zillow.com')) {
    return 'zillow_url';
  }
  
  // Zip code detection (5 digits)
  if (/^\d{5}$/.test(trimmed)) {
    return 'zip_code';
  }
  
  // Address detection (starts with number, contains street keywords)
  const addressPattern = /^\d+\s+[\w\s]+\s+(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|way|ct|court|pl|place|cir|circle)/i;
  if (addressPattern.test(trimmed)) {
    return 'address';
  }
  
  // Check if it looks like a city name (short, no question marks, common patterns)
  const cityPattern = /^[a-z\s,]+$/i;
  const questionWords = ['what', 'how', 'why', 'is', 'are', 'can', 'should', 'compare', 'which', 'tell', 'show', 'analyze'];
  const startsWithQuestion = questionWords.some(word => trimmed.startsWith(word));
  
  if (!startsWithQuestion && cityPattern.test(trimmed) && trimmed.length < 50 && !trimmed.includes('?')) {
    // Could be a city - check if it has comma (city, state format)
    if (trimmed.includes(',') || trimmed.split(' ').length <= 3) {
      return 'city';
    }
  }
  
  // Default to question/natural language
  return 'question';
}

function getInputTypeLabel(type: InputType): string {
  switch (type) {
    case 'zillow_url': return 'Zillow Property';
    case 'zip_code': return 'Zip Code';
    case 'address': return 'Property Address';
    case 'city': return 'City/Market';
    case 'question': return 'Question';
  }
}

function getInputTypeIcon(type: InputType) {
  switch (type) {
    case 'zillow_url': return <ExternalLink className="w-4 h-4" />;
    case 'zip_code': return <MapPin className="w-4 h-4" />;
    case 'address': return <Home className="w-4 h-4" />;
    case 'city': return <Building className="w-4 h-4" />;
    case 'question': return <Sparkles className="w-4 h-4" />;
  }
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-[#0F172A]' : 'bg-gradient-to-br from-[#C9A962] to-[#a88b4a]'
      }`}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>
      <div className={`max-w-[85%] rounded-2xl px-5 py-4 ${
        isUser 
          ? 'bg-[#0F172A] text-white rounded-tr-sm' 
          : 'bg-white border border-[#0F172A]/10 text-[#0F172A] rounded-tl-sm shadow-md'
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

const suggestedActions = [
  { icon: <TrendingUp className="w-5 h-5" />, text: "Compare Austin vs Nashville", type: "question" as const },
  { icon: <DollarSign className="w-5 h-5" />, text: "What's the average revenue in Miami?", type: "question" as const },
  { icon: <MapPin className="w-5 h-5" />, text: "78701", type: "zip" as const, label: "Austin Downtown" },
  { icon: <Building className="w-5 h-5" />, text: "Denver, CO", type: "city" as const },
  { icon: <BarChart3 className="w-5 h-5" />, text: "Which market has the best ROI?", type: "question" as const },
  { icon: <Home className="w-5 h-5" />, text: "Analyze a property address", type: "prompt" as const },
];

export default function SmartHome() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [detectedType, setDetectedType] = useState<InputType>('question');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  const advisorMutation = trpc.advanced.getInvestmentAdvice.useMutation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (input.trim()) {
      setDetectedType(detectInputType(input));
    } else {
      setDetectedType('question');
    }
  }, [input]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const inputType = detectInputType(messageText);
    const userMessage: ChatMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Handle different input types
      if (inputType === 'address') {
        // For property addresses, redirect to the property report page
        // But first, let the AI acknowledge and provide context
        const result = await advisorMutation.mutateAsync({
          question: `The user wants to analyze this property address: "${messageText}". Please acknowledge and explain that you'll analyze this property. Then provide any initial market context you can find for the area.`,
          conversationHistory: messages,
        });

        if (result.success && result.data?.response) {
          const assistantMessage: ChatMessage = { 
            role: 'assistant', 
            content: result.data.response + "\n\n**[Click here to see the full property analysis →](/)**"
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        
        // Store the address for the property report
        sessionStorage.setItem('pendingPropertyAddress', messageText);
        
      } else if (inputType === 'zillow_url') {
        // Parse Zillow URL and analyze
        const result = await advisorMutation.mutateAsync({
          question: `The user shared a Zillow link: "${messageText}". Please acknowledge this and explain that you'll analyze the property from this listing.`,
          conversationHistory: messages,
        });

        if (result.success && result.data?.response) {
          const assistantMessage: ChatMessage = { 
            role: 'assistant', 
            content: result.data.response
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        
      } else if (inputType === 'zip_code') {
        // Analyze zip code market
        const result = await advisorMutation.mutateAsync({
          question: `Analyze the short-term rental market for zip code ${messageText}. What are the revenue expectations, occupancy rates, and investment potential?`,
          conversationHistory: messages,
        });

        if (result.success && result.data?.response) {
          const assistantMessage: ChatMessage = { 
            role: 'assistant', 
            content: result.data.response
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        
      } else if (inputType === 'city') {
        // Analyze city market
        const result = await advisorMutation.mutateAsync({
          question: `Analyze the short-term rental market in ${messageText}. What are the revenue expectations, occupancy rates, ADR, and investment potential?`,
          conversationHistory: messages,
        });

        if (result.success && result.data?.response) {
          const assistantMessage: ChatMessage = { 
            role: 'assistant', 
            content: result.data.response
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
        
      } else {
        // Natural language question - send to AI Advisor
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
      }
    } catch (error) {
      console.error('Error:', error);
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

  const handleSuggestedAction = (action: typeof suggestedActions[0]) => {
    if (action.type === 'prompt') {
      inputRef.current?.focus();
      return;
    }
    handleSend(action.text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] via-[#0F172A] to-[#1a2744] flex flex-col">
      {/* Header */}
      <div className="py-6 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C9A962] to-[#a88b4a] mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-semibold text-white mb-2">
            STR Investment Advisor
          </h1>
          <p className="text-white/60 text-lg">
            Ask anything about short-term rental markets
          </p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 pb-6 flex flex-col">
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8">
            <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 max-w-2xl w-full border border-white/10">
              <h2 className="text-2xl font-serif font-semibold text-white mb-3">
                What would you like to know?
              </h2>
              <p className="text-white/50 mb-8">
                Enter a property address, city, zip code, or ask any question about STR investing
              </p>
              
              {/* Smart Input */}
              <div className="relative mb-8">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter address, city, zip code, or ask a question..."
                      className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl py-6 px-4 pr-24 text-lg focus:border-[#C9A962] focus:ring-[#C9A962]/20"
                      disabled={isLoading}
                    />
                    {input.trim() && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs">
                        <span className="bg-[#C9A962]/20 text-[#C9A962] px-2 py-1 rounded-full flex items-center gap-1">
                          {getInputTypeIcon(detectedType)}
                          {getInputTypeLabel(detectedType)}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    className="bg-[#C9A962] hover:bg-[#b8994f] text-white rounded-xl px-6 h-auto"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Suggested Actions */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {suggestedActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedAction(action)}
                    className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#C9A962]/50 transition-all duration-200 text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#C9A962]/20 flex items-center justify-center text-[#C9A962] group-hover:bg-[#C9A962]/30 transition-colors">
                      {action.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{action.text}</p>
                      {action.label && (
                        <p className="text-white/40 text-xs">{action.label}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Features */}
            <div className="grid grid-cols-3 gap-6 mt-10 max-w-xl">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-[#C9A962]" />
                </div>
                <p className="text-sm font-medium text-white">Smart Detection</p>
                <p className="text-xs text-white/40">Auto-detects input type</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Zap className="w-6 h-6 text-[#C9A962]" />
                </div>
                <p className="text-sm font-medium text-white">Real-Time Data</p>
                <p className="text-xs text-white/40">Fresh AirDNA stats</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Bot className="w-6 h-6 text-[#C9A962]" />
                </div>
                <p className="text-sm font-medium text-white">AI Powered</p>
                <p className="text-xs text-white/40">Intelligent insights</p>
              </div>
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="flex-1 bg-[#FAF9F6] rounded-t-3xl p-6 space-y-4 overflow-y-auto">
            {messages.map((message, index) => (
              <MessageBubble key={index} message={message} />
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C9A962] to-[#a88b4a] flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white border border-[#0F172A]/10 rounded-2xl rounded-tl-sm px-5 py-4 shadow-md">
                  <div className="flex items-center gap-3 text-[#0F172A]/60">
                    <Loader2 className="w-5 h-5 animate-spin text-[#C9A962]" />
                    <span className="text-sm">Analyzing market data...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area (shown when there are messages) */}
        {messages.length > 0 && (
          <div className="bg-[#FAF9F6] rounded-b-3xl border-t border-[#0F172A]/10 p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a follow-up question or enter a new address..."
                  className="flex-1 border-2 border-[#0F172A]/10 focus:border-[#C9A962] rounded-xl py-3 px-4 pr-24"
                  disabled={isLoading}
                />
                {input.trim() && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs">
                    <span className="bg-[#C9A962]/10 text-[#C9A962] px-2 py-1 rounded-full flex items-center gap-1">
                      {getInputTypeIcon(detectedType)}
                      {getInputTypeLabel(detectedType)}
                    </span>
                  </div>
                )}
              </div>
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
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-4 text-center">
        <p className="text-white/30 text-xs">
          Powered by AirDNA market data • Real-time analysis
        </p>
      </div>
    </div>
  );
}
