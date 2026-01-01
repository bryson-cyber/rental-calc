/**
 * Smart Home - AI-First Unified Experience
 * 
 * Single smart input that auto-detects:
 * - Property addresses → Property analysis
 * - Zillow URLs → Parse and analyze property
 * - Zip codes → Market analysis
 * - City names → Market analysis
 * - Natural language questions → AI Advisor
 * 
 * Features:
 * - Smart autocomplete for addresses, markets, and zip codes
 * - Zillow link parsing
 * - Conversation memory for follow-up questions
 * - Comprehensive filtering options
 */

import { useState, useRef, useEffect, useCallback } from 'react';
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
  ExternalLink,
  BedDouble,
  Filter,
  Star,
  Award,
  X,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';


interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'property_report' | 'market_report';
  data?: unknown;
  filters?: ActiveFilters;
}

interface ActiveFilters {
  bedrooms?: number;
  propertyType?: string;
  minRating?: number;
  superhost?: boolean;
  amenities?: string[];
}

interface AutocompleteSuggestion {
  type: 'address' | 'market' | 'zip';
  text: string;
  subtext?: string;
  icon: React.ReactNode;
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
    if (trimmed.includes(',') || trimmed.split(' ').length <= 3) {
      return 'city';
    }
  }
  
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

// Parse Zillow URL to extract address
function parseZillowUrl(url: string): { address: string; zipCode?: string } | null {
  try {
    // Zillow URLs typically have format: zillow.com/homedetails/123-Main-St-City-State-12345/12345_zpid
    const match = url.match(/homedetails\/([^/]+)\//);
    if (match) {
      const slug = match[1];
      // Convert slug to address: "123-Main-St-City-State-12345" -> "123 Main St, City, State 12345"
      const parts = slug.replace(/-/g, ' ').split(' ');
      
      // Find zip code (5 digits at the end)
      const zipIndex = parts.findIndex(p => /^\d{5}$/.test(p));
      const zipCode = zipIndex >= 0 ? parts[zipIndex] : undefined;
      
      // Reconstruct address
      const addressParts = zipIndex >= 0 ? parts.slice(0, zipIndex + 1) : parts;
      const address = addressParts.join(' ');
      
      return { address, zipCode };
    }
    return null;
  } catch {
    return null;
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
        {/* Show active filters if any */}
        {isUser && message.filters && Object.keys(message.filters).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {message.filters.bedrooms && (
              <span className="text-xs bg-[#C9A962]/30 px-2 py-0.5 rounded-full">{message.filters.bedrooms} BR</span>
            )}
            {message.filters.propertyType && (
              <span className="text-xs bg-[#C9A962]/30 px-2 py-0.5 rounded-full">{message.filters.propertyType}</span>
            )}
            {message.filters.minRating && (
              <span className="text-xs bg-[#C9A962]/30 px-2 py-0.5 rounded-full">{message.filters.minRating}+ stars</span>
            )}
            {message.filters.superhost && (
              <span className="text-xs bg-[#C9A962]/30 px-2 py-0.5 rounded-full">Superhost</span>
            )}
          </div>
        )}
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

// Filter chip component
function FilterChip({ 
  label, 
  active, 
  onClick,
  icon
}: { 
  label: string; 
  active: boolean; 
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        active 
          ? 'bg-[#C9A962] text-white' 
          : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
      }`}
    >
      {icon}
      {label}
      {active && <X className="w-3 h-3 ml-1" />}
    </button>
  );
}

// Dropdown filter component
function FilterDropdown({
  label,
  options,
  value,
  onChange,
  icon
}: {
  label: string;
  options: { value: string | number; label: string }[];
  value?: string | number;
  onChange: (value: string | number | undefined) => void;
  icon?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          value !== undefined 
            ? 'bg-[#C9A962] text-white' 
            : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
        }`}
      >
        {icon}
        {value !== undefined ? options.find(o => o.value === value)?.label || label : label}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-[#1a2744] border border-white/10 rounded-lg shadow-xl z-50 min-w-[120px] py-1">
          <button
            onClick={() => { onChange(undefined); setIsOpen(false); }}
            className="w-full px-3 py-1.5 text-left text-xs text-white/70 hover:bg-white/10"
          >
            Any
          </button>
          {options.map(option => (
            <button
              key={option.value}
              onClick={() => { onChange(option.value); setIsOpen(false); }}
              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-white/10 ${
                value === option.value ? 'text-[#C9A962]' : 'text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const suggestedActions = [
  { icon: <TrendingUp className="w-5 h-5" />, text: "Compare Austin vs Nashville", type: "question" as const },
  { icon: <DollarSign className="w-5 h-5" />, text: "What's the average revenue in Miami?", type: "question" as const },
  { icon: <MapPin className="w-5 h-5" />, text: "78701", type: "zip" as const, label: "Austin Downtown" },
  { icon: <Building className="w-5 h-5" />, text: "Denver, CO", type: "city" as const },
  { icon: <BarChart3 className="w-5 h-5" />, text: "Which market has the best ROI?", type: "question" as const },
  { icon: <Home className="w-5 h-5" />, text: "Analyze 123 Main St, Austin TX", type: "address" as const },
];

const bedroomOptions = [
  { value: 1, label: '1 BR' },
  { value: 2, label: '2 BR' },
  { value: 3, label: '3 BR' },
  { value: 4, label: '4 BR' },
  { value: 5, label: '5+ BR' },
];

const propertyTypeOptions = [
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'cabin', label: 'Cabin' },
];

const ratingOptions = [
  { value: 4.8, label: '4.8+ Stars' },
  { value: 4.5, label: '4.5+ Stars' },
  { value: 4.0, label: '4.0+ Stars' },
  { value: 3.0, label: '3.0+ Stars' },
];

export default function SmartHome() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [detectedType, setDetectedType] = useState<InputType>('question');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filters state
  const [filters, setFilters] = useState<ActiveFilters>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
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

  // Debounced autocomplete search
  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowAutocomplete(false);
      return;
    }

    const timer = setTimeout(async () => {
      const newSuggestions: AutocompleteSuggestion[] = [];
      
      // Check if it's a zip code pattern
      if (/^\d{1,5}$/.test(trimmed)) {
        // Add zip code suggestions
        newSuggestions.push({
          type: 'zip',
          text: trimmed.padEnd(5, '0').slice(0, 5),
          subtext: 'Search zip code',
          icon: <MapPin className="w-4 h-4 text-[#C9A962]" />
        });
      }
      
      // Search for markets using fetch
      try {
        const response = await fetch(`/api/trpc/rental.searchMarkets?input=${encodeURIComponent(JSON.stringify({ searchTerm: trimmed, limit: 5 }))}`);
        const data = await response.json();
        if (data?.result?.data?.success && data?.result?.data?.data) {
          data.result.data.data.forEach((market: { name: string; location_name?: string; id: string }) => {
            newSuggestions.push({
              type: 'market',
              text: market.name,
              subtext: market.location_name || 'Market',
              icon: <Building className="w-4 h-4 text-[#C9A962]" />,
              data: market
            });
          });
        }
      } catch (e) {
        // Silently fail for market search
      }
      
      // If it looks like an address, add address suggestion
      if (/\d+\s+\w+/.test(trimmed)) {
        newSuggestions.push({
          type: 'address',
          text: trimmed,
          subtext: 'Analyze this address',
          icon: <Home className="w-4 h-4 text-[#C9A962]" />
        });
      }
      
      setSuggestions(newSuggestions);
      setShowAutocomplete(newSuggestions.length > 0);
      setSelectedSuggestionIndex(-1);
    }, 300);

    return () => clearTimeout(timer);
  }, [input]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSuggestion = (suggestion: AutocompleteSuggestion) => {
    setInput(suggestion.text);
    setShowAutocomplete(false);
    inputRef.current?.focus();
  };

  const buildFilterContext = (): string => {
    const parts: string[] = [];
    if (filters.bedrooms) parts.push(`${filters.bedrooms} bedroom properties`);
    if (filters.propertyType) parts.push(`${filters.propertyType} type`);
    if (filters.minRating) parts.push(`${filters.minRating}+ star rating`);
    if (filters.superhost) parts.push(`superhost only`);
    if (filters.amenities?.length) parts.push(`with ${filters.amenities.join(', ')}`);
    
    return parts.length > 0 ? ` Focus on ${parts.join(', ')}.` : '';
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const inputType = detectInputType(messageText);
    const filterContext = buildFilterContext();
    
    const userMessage: ChatMessage = { 
      role: 'user', 
      content: messageText,
      filters: Object.keys(filters).length > 0 ? { ...filters } : undefined
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowAutocomplete(false);
    setIsLoading(true);

    try {
      let questionToAsk = messageText;
      
      // Handle Zillow URL parsing
      if (inputType === 'zillow_url') {
        const parsed = parseZillowUrl(messageText);
        if (parsed) {
          questionToAsk = `Analyze this property: ${parsed.address}${parsed.zipCode ? ` (zip code: ${parsed.zipCode})` : ''}.${filterContext}`;
          // Zillow link detected and parsed
        } else {
          questionToAsk = `The user shared a Zillow link: "${messageText}". Please try to analyze this property.${filterContext}`;
        }
      } else if (inputType === 'address') {
        questionToAsk = `Analyze this property address: "${messageText}".${filterContext}`;
      } else if (inputType === 'zip_code') {
        questionToAsk = `Analyze the short-term rental market for zip code ${messageText}. What are the revenue expectations, occupancy rates, and investment potential?${filterContext}`;
      } else if (inputType === 'city') {
        questionToAsk = `Analyze the short-term rental market in ${messageText}. What are the revenue expectations, occupancy rates, ADR, and investment potential?${filterContext}`;
      } else {
        questionToAsk = messageText + filterContext;
      }

      // Send to AI Advisor with conversation history
      const result = await advisorMutation.mutateAsync({
        question: questionToAsk,
        conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
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
    if (showAutocomplete && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[selectedSuggestionIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowAutocomplete(false);
        return;
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedAction = (action: typeof suggestedActions[0]) => {
    handleSend(action.text);
  };

  const clearFilters = () => {
    setFilters({});
  };

  const hasActiveFilters = Object.keys(filters).some(key => {
    const value = filters[key as keyof ActiveFilters];
    return value !== undefined && value !== false && (Array.isArray(value) ? value.length > 0 : true);
  });

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
              <p className="text-white/50 mb-6">
                Enter a property address, city, zip code, or ask any question about STR investing
              </p>
              
              {/* Smart Input with Autocomplete */}
              <div className="relative mb-4" ref={autocompleteRef}>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => suggestions.length > 0 && setShowAutocomplete(true)}
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
                    
                    {/* Autocomplete Dropdown */}
                    {showAutocomplete && suggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a2744] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {suggestions.map((suggestion, index) => (
                          <button
                            key={`${suggestion.type}-${suggestion.text}-${index}`}
                            onClick={() => selectSuggestion(suggestion)}
                            className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/10 transition-colors ${
                              index === selectedSuggestionIndex ? 'bg-white/10' : ''
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-[#C9A962]/20 flex items-center justify-center">
                              {suggestion.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{suggestion.text}</p>
                              {suggestion.subtext && (
                                <p className="text-white/40 text-xs truncate">{suggestion.subtext}</p>
                              )}
                            </div>
                            <span className="text-xs text-white/30 capitalize">{suggestion.type}</span>
                          </button>
                        ))}
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
              
              {/* Filter Toggle */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                    showFilters || hasActiveFilters
                      ? 'bg-[#C9A962]/20 text-[#C9A962]' 
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="w-2 h-2 rounded-full bg-[#C9A962]" />
                  )}
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-white/40 hover:text-white/60"
                  >
                    Clear all
                  </button>
                )}
              </div>
              
              {/* Filters Panel */}
              {showFilters && (
                <div className="flex flex-wrap items-center justify-center gap-2 mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                  <FilterDropdown
                    label="Bedrooms"
                    options={bedroomOptions}
                    value={filters.bedrooms}
                    onChange={(v) => setFilters(prev => ({ ...prev, bedrooms: v as number | undefined }))}
                    icon={<BedDouble className="w-3 h-3" />}
                  />
                  <FilterDropdown
                    label="Property Type"
                    options={propertyTypeOptions}
                    value={filters.propertyType}
                    onChange={(v) => setFilters(prev => ({ ...prev, propertyType: v as string | undefined }))}
                    icon={<Home className="w-3 h-3" />}
                  />
                  <FilterDropdown
                    label="Rating"
                    options={ratingOptions}
                    value={filters.minRating}
                    onChange={(v) => setFilters(prev => ({ ...prev, minRating: v as number | undefined }))}
                    icon={<Star className="w-3 h-3" />}
                  />
                  <FilterChip
                    label="Superhost"
                    active={!!filters.superhost}
                    onClick={() => setFilters(prev => ({ ...prev, superhost: !prev.superhost }))}
                    icon={<Award className="w-3 h-3" />}
                  />
                </div>
              )}
              
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
            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs text-[#0F172A]/50">Active filters:</span>
                {filters.bedrooms && (
                  <span className="text-xs bg-[#C9A962]/20 text-[#C9A962] px-2 py-1 rounded-full flex items-center gap-1">
                    {filters.bedrooms} BR
                    <button onClick={() => setFilters(prev => ({ ...prev, bedrooms: undefined }))} className="hover:text-[#0F172A]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.propertyType && (
                  <span className="text-xs bg-[#C9A962]/20 text-[#C9A962] px-2 py-1 rounded-full flex items-center gap-1">
                    {filters.propertyType}
                    <button onClick={() => setFilters(prev => ({ ...prev, propertyType: undefined }))} className="hover:text-[#0F172A]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.minRating && (
                  <span className="text-xs bg-[#C9A962]/20 text-[#C9A962] px-2 py-1 rounded-full flex items-center gap-1">
                    {filters.minRating}+ stars
                    <button onClick={() => setFilters(prev => ({ ...prev, minRating: undefined }))} className="hover:text-[#0F172A]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.superhost && (
                  <span className="text-xs bg-[#C9A962]/20 text-[#C9A962] px-2 py-1 rounded-full flex items-center gap-1">
                    Superhost
                    <button onClick={() => setFilters(prev => ({ ...prev, superhost: false }))} className="hover:text-[#0F172A]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-xs text-[#0F172A]/40 hover:text-[#0F172A]/60 underline"
                >
                  Clear all
                </button>
              </div>
            )}
            
            <div className="flex gap-2">
              <div className="relative flex-1" ref={autocompleteRef}>
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowAutocomplete(true)}
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
                
                {/* Autocomplete Dropdown */}
                {showAutocomplete && suggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-[#0F172A]/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.type}-${suggestion.text}-${index}`}
                        onClick={() => selectSuggestion(suggestion)}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-[#C9A962]/10 transition-colors ${
                          index === selectedSuggestionIndex ? 'bg-[#C9A962]/10' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#C9A962]/20 flex items-center justify-center">
                          {suggestion.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[#0F172A] text-sm font-medium truncate">{suggestion.text}</p>
                          {suggestion.subtext && (
                            <p className="text-[#0F172A]/40 text-xs truncate">{suggestion.subtext}</p>
                          )}
                        </div>
                        <span className="text-xs text-[#0F172A]/30 capitalize">{suggestion.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Filter button in chat mode */}
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className={`rounded-xl px-3 ${hasActiveFilters ? 'border-[#C9A962] text-[#C9A962]' : ''}`}
              >
                <Filter className="w-5 h-5" />
              </Button>
              
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
            
            {/* Filters Panel in Chat Mode */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-2 mt-3 p-3 bg-[#0F172A]/5 rounded-xl">
                <FilterDropdown
                  label="Bedrooms"
                  options={bedroomOptions}
                  value={filters.bedrooms}
                  onChange={(v) => setFilters(prev => ({ ...prev, bedrooms: v as number | undefined }))}
                  icon={<BedDouble className="w-3 h-3" />}
                />
                <FilterDropdown
                  label="Property Type"
                  options={propertyTypeOptions}
                  value={filters.propertyType}
                  onChange={(v) => setFilters(prev => ({ ...prev, propertyType: v as string | undefined }))}
                  icon={<Home className="w-3 h-3" />}
                />
                <FilterDropdown
                  label="Rating"
                  options={ratingOptions}
                  value={filters.minRating}
                  onChange={(v) => setFilters(prev => ({ ...prev, minRating: v as number | undefined }))}
                  icon={<Star className="w-3 h-3" />}
                />
                <FilterChip
                  label="Superhost"
                  active={!!filters.superhost}
                  onClick={() => setFilters(prev => ({ ...prev, superhost: !prev.superhost }))}
                  icon={<Award className="w-3 h-3" />}
                />
              </div>
            )}
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
