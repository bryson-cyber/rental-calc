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
import { usePersistFn } from '@/hooks/usePersistFn';
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
  Bath,
  Filter,
  X,
  ChevronDown,
  Clock,
  History,
  Heart,
  FileDown,
  FileText,
  Trash2,
  Star,
  Scale,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';


interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'property_report' | 'market_report';
  data?: unknown;
  filters?: ActiveFilters;
  followUpQuestions?: string[];
}

interface ActiveFilters {
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  minRating?: number;
  superhost?: boolean;
  instantBook?: boolean;
  professionallyManaged?: boolean;
  priceTier?: string;
  amenities?: string[];
}

interface RecentSearch {
  text: string;
  type: 'address' | 'market' | 'zip' | 'question';
  timestamp: number;
}

interface AutocompleteSuggestion {
  type: 'address' | 'market' | 'zip' | 'recent';
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

function MessageBubble({ 
  message, 
  onSaveToFavorites,
  onExportPDF,
  onFollowUpClick,
  onGenerateReport,
  isSaved 
}: { 
  message: ChatMessage; 
  onSaveToFavorites?: () => void;
  onExportPDF?: () => void;
  onFollowUpClick?: (question: string) => void;
  onGenerateReport?: () => void;
  isSaved?: boolean;
}) {
  const isUser = message.role === 'user';
  const isPropertyAnalysis = !isUser && message.content.includes('Annual Revenue') && message.content.includes('$');
  
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
            {message.filters.bathrooms && (
              <span className="text-xs bg-[#C9A962]/30 px-2 py-0.5 rounded-full">{message.filters.bathrooms} BA</span>
            )}
            {message.filters.propertyType && (
              <span className="text-xs bg-[#C9A962]/30 px-2 py-0.5 rounded-full">{message.filters.propertyType}</span>
            )}
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none text-[#0F172A] prose-headings:text-[#0F172A] prose-strong:text-[#0F172A] prose-li:marker:text-[#C9A962]">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({children}) => (
                  <table className="w-full border-collapse my-4 text-sm">{children}</table>
                ),
                thead: ({children}) => (
                  <thead className="bg-[#0F172A]/5">{children}</thead>
                ),
                th: ({children}) => (
                  <th className="border border-[#0F172A]/20 px-3 py-2 text-left font-semibold text-[#0F172A]">{children}</th>
                ),
                td: ({children}) => (
                  <td className="border border-[#0F172A]/20 px-3 py-2">{children}</td>
                ),
                tr: ({children}) => (
                  <tr className="even:bg-[#0F172A]/5">{children}</tr>
                ),
                a: ({href, children}) => (
                  <a 
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#C9A962] hover:text-[#B8944D] underline font-medium inline-flex items-center gap-1"
                  >
                    {children}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ),
              }}
            >{message.content}</ReactMarkdown>
          </div>
        )}
        
        {/* Action buttons for property analyses */}
        {isPropertyAnalysis && (onSaveToFavorites || onExportPDF) && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#0F172A]/10">
            {onSaveToFavorites && (
              <button
                onClick={onSaveToFavorites}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isSaved 
                    ? 'bg-[#C9A962] text-white' 
                    : 'bg-[#C9A962]/10 text-[#C9A962] hover:bg-[#C9A962]/20'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                {isSaved ? 'Saved' : 'Save to Favorites'}
              </button>
            )}
            {onExportPDF && (
              <button
                onClick={onExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#0F172A]/10 text-[#0F172A] hover:bg-[#0F172A]/20 transition-all"
              >
                <FileDown className="w-3.5 h-3.5" />
                Export PDF
              </button>
            )}
            {onGenerateReport && (
              <button
                onClick={onGenerateReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#C9A962] text-white hover:bg-[#b8984f] transition-all"
              >
                <FileText className="w-3.5 h-3.5" />
                Generate Full Report
              </button>
            )}
          </div>
        )}
        
        {/* Follow-up Questions */}
        {!isUser && message.followUpQuestions && message.followUpQuestions.length > 0 && onFollowUpClick && (
          <div className="mt-4 pt-4 border-t border-[#0F172A]/10">
            <p className="text-xs text-[#0F172A]/50 mb-2 font-medium">Explore further:</p>
            <div className="flex flex-wrap gap-2">
              {message.followUpQuestions.map((question, idx) => (
                <button
                  key={idx}
                  onClick={() => onFollowUpClick(question)}
                  className="text-xs bg-[#0F172A]/5 hover:bg-[#C9A962]/20 text-[#0F172A] hover:text-[#0F172A] px-3 py-2 rounded-lg transition-all border border-[#0F172A]/10 hover:border-[#C9A962]/30 text-left"
                >
                  {question}
                </button>
              ))}
            </div>
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
  { icon: <TrendingUp className="w-5 h-5" />, text: "Compare Austi...", fullText: "Compare Austin vs Nashville for a beginner investor", type: "question" as const },
  { icon: <DollarSign className="w-5 h-5" />, text: "What's the ave...", fullText: "What's the average revenue in Miami for a 3BR?", type: "question" as const },
  { icon: <MapPin className="w-5 h-5" />, text: "78701", fullText: "78701", type: "zip" as const, label: "Austin Downtown" },
  { icon: <Building className="w-5 h-5" />, text: "Denver, CO", fullText: "Denver, CO", type: "city" as const },
  { icon: <BarChart3 className="w-5 h-5" />, text: "Which market ...", fullText: "Which market is best for first-time arbitrage investors?", type: "question" as const },
  { icon: <Home className="w-5 h-5" />, text: "Analyze 123 Ma...", fullText: "Analyze 123 Main St, Austin TX - rent is $2,000/month", type: "address" as const },
];

const bedroomOptions = [
  { value: 1, label: '1 BR' },
  { value: 2, label: '2 BR' },
  { value: 3, label: '3 BR' },
  { value: 4, label: '4 BR' },
  { value: 5, label: '5+ BR' },
];

const bathroomOptions = [
  { value: 1, label: '1 BA' },
  { value: 1.5, label: '1.5 BA' },
  { value: 2, label: '2 BA' },
  { value: 2.5, label: '2.5 BA' },
  { value: 3, label: '3 BA' },
  { value: 4, label: '4+ BA' },
];

// Recent searches storage key
const RECENT_SEARCHES_KEY = 'str-advisor-recent-searches';

const propertyTypeOptions = [
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'cabin', label: 'Cabin' },
  { value: 'villa', label: 'Villa' },
  { value: 'cottage', label: 'Cottage' },
];

const amenityOptions = [
  { value: 'has_pool', label: 'Pool', icon: '🏊' },
  { value: 'has_hottub', label: 'Hot Tub', icon: '♨️' },
  { value: 'has_pets_allowed', label: 'Pet Friendly', icon: '🐕' },
  { value: 'has_parking', label: 'Parking', icon: '🅿️' },
  { value: 'has_gym', label: 'Gym', icon: '💪' },
  { value: 'has_kitchen', label: 'Kitchen', icon: '🍳' },
  { value: 'has_washer', label: 'Washer/Dryer', icon: '🧺' },
  { value: 'has_aircon', label: 'A/C', icon: '❄️' },
];

const priceTierOptions = [
  { value: 'budget', label: 'Budget' },
  { value: 'midscale', label: 'Midscale' },
  { value: 'upscale', label: 'Upscale' },
  { value: 'luxury', label: 'Luxury' },
];

const ratingOptions = [
  { value: 4.0, label: '4.0+' },
  { value: 4.5, label: '4.5+' },
  { value: 4.8, label: '4.8+' },
];

// Favorites Panel Component
function FavoritesPanel({ 
  sessionId, 
  onClose, 
  onAnalyze,
  onCompare
}: { 
  sessionId: string; 
  onClose: () => void; 
  onAnalyze: (address: string) => void;
  onCompare: (favorites: Array<{ address: string; bedrooms?: number; annualRevenue?: number; occupancyRate?: number; averageDailyRate?: number; marketName?: string }>) => void;
}) {
  const favoritesQuery = trpc.favorites.list.useQuery({ sessionId });
  const removeFavorite = trpc.favorites.remove.useMutation({
    onSuccess: () => favoritesQuery.refetch(),
  });
  const updateNotes = trpc.favorites.updateNotes.useMutation({
    onSuccess: () => favoritesQuery.refetch(),
  });
  
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [selectedForCompare, setSelectedForCompare] = useState<Set<number>>(new Set());
  
  const toggleCompareSelection = (id: number) => {
    setSelectedForCompare(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else if (newSet.size < 3) {
        newSet.add(id);
      } else {
        toast.error('You can compare up to 3 properties at a time');
      }
      return newSet;
    });
  };
  
  const favorites = favoritesQuery.data?.data || [];
  
  return (
    <div className="max-w-4xl w-full mx-auto px-4 mb-6">
      <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-serif font-semibold text-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-[#C9A962] fill-current" />
            My Favorite Properties
          </h2>
          <div className="flex items-center gap-2">
            {selectedForCompare.size >= 2 && (
              <button
                onClick={() => {
                  const selectedFavs = favorites.filter(f => selectedForCompare.has(f.id));
                  onCompare(selectedFavs.map(f => ({
                    address: f.address,
                    bedrooms: f.bedrooms ?? undefined,
                    annualRevenue: f.annualRevenue ?? undefined,
                    occupancyRate: f.occupancyRate ? Number(f.occupancyRate) : undefined,
                    averageDailyRate: f.averageDailyRate ? Number(f.averageDailyRate) : undefined,
                    marketName: f.marketName ?? undefined
                  })));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#C9A962] text-white hover:bg-[#b8994f] transition-all"
              >
                <Scale className="w-3.5 h-3.5" />
                Compare {selectedForCompare.size} Properties
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Selection hint */}
        {favorites.length >= 2 && selectedForCompare.size < 2 && (
          <div className="mb-4 px-3 py-2 bg-[#C9A962]/10 rounded-lg border border-[#C9A962]/20">
            <p className="text-[#C9A962] text-xs flex items-center gap-2">
              <Scale className="w-3.5 h-3.5" />
              Select 2-3 properties to compare them side-by-side
            </p>
          </div>
        )}
        
        {favoritesQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#C9A962]" />
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-8">
            <Heart className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/50">No favorite properties yet</p>
            <p className="text-white/30 text-sm mt-1">Analyze a property and click the heart to save it</p>
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map((fav) => (
              <div 
                key={fav.id} 
                className={`bg-white/5 rounded-xl p-4 border transition-colors cursor-pointer ${
                  selectedForCompare.has(fav.id) 
                    ? 'border-[#C9A962] bg-[#C9A962]/10' 
                    : 'border-white/10 hover:border-[#C9A962]/30'
                }`}
                onClick={() => toggleCompareSelection(fav.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Checkbox */}
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      selectedForCompare.has(fav.id)
                        ? 'bg-[#C9A962] border-[#C9A962]'
                        : 'border-white/30 hover:border-[#C9A962]/50'
                    }`}>
                      {selectedForCompare.has(fav.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{fav.address}</h3>
                      <div className="flex flex-wrap gap-2 mt-2 text-sm">
                      {fav.marketName && (
                        <span className="text-white/50">{fav.marketName}</span>
                      )}
                      {fav.bedrooms && (
                        <span className="bg-[#C9A962]/20 text-[#C9A962] px-2 py-0.5 rounded-full text-xs">
                          {fav.bedrooms} BR
                        </span>
                      )}
                      {fav.annualRevenue && (
                        <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs">
                          ${fav.annualRevenue.toLocaleString()}/yr
                        </span>
                      )}
                      {fav.occupancyRate && (
                        <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs">
                          {Number(fav.occupancyRate).toFixed(0)}% occ
                        </span>
                      )}
                    </div>
                    
                    {/* Notes section */}
                    {editingNotes === fav.id ? (
                      <div className="mt-3">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add notes about this property..."
                          className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-sm text-white placeholder:text-white/40 resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              updateNotes.mutate({ id: fav.id, notes: noteText, sessionId });
                              setEditingNotes(null);
                            }}
                            className="text-xs bg-[#C9A962] text-white px-3 py-1 rounded-full"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="text-xs text-white/50 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : fav.notes ? (
                      <p 
                        className="text-white/40 text-sm mt-2 cursor-pointer hover:text-white/60"
                        onClick={() => { setEditingNotes(fav.id); setNoteText(fav.notes || ''); }}
                      >
                        {fav.notes}
                      </p>
                    ) : (
                      <button
                        onClick={() => { setEditingNotes(fav.id); setNoteText(''); }}
                        className="text-white/30 text-xs mt-2 hover:text-white/50"
                      >
                        + Add notes
                      </button>
                    )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onAnalyze(fav.address)}
                      className="p-2 bg-[#C9A962]/20 text-[#C9A962] rounded-lg hover:bg-[#C9A962]/30 transition-colors"
                      title="Analyze again"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeFavorite.mutate({ id: fav.id, sessionId })}
                      className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      title="Remove from favorites"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  
  // Favorites state
  const [showFavorites, setShowFavorites] = useState(false);
  const [sessionId] = useState(() => {
    // Get or create a session ID for anonymous users
    const stored = localStorage.getItem('str-advisor-session-id');
    if (stored) return stored;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('str-advisor-session-id', newId);
    return newId;
  });
  
  // Recent searches state
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  
  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentSearch[];
        // Keep only last 10 searches from the past 7 days
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const filtered = parsed.filter(s => s.timestamp > weekAgo).slice(0, 10);
        setRecentSearches(filtered);
      }
    } catch (e) {
      console.error('Error loading recent searches:', e);
    }
  }, []);
  
  // Save search to recent searches
  const saveRecentSearch = (text: string, type: 'address' | 'market' | 'zip' | 'question') => {
    const newSearch: RecentSearch = { text, type, timestamp: Date.now() };
    setRecentSearches(prev => {
      // Remove duplicates and add new search at the beginning
      const filtered = prev.filter(s => s.text.toLowerCase() !== text.toLowerCase());
      const updated = [newSearch, ...filtered].slice(0, 10);
      // Save to localStorage
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving recent searches:', e);
      }
      return updated;
    });
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const placesServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [, setLocation] = useLocation();

  // Load Google Maps script for Places Autocomplete
  const loadGoogleMaps = usePersistFn(async () => {
    if (window.google?.maps?.places) {
      placesServiceRef.current = new window.google.maps.places.AutocompleteService();
      setGoogleLoaded(true);
      return;
    }

    const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
    const FORGE_BASE_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL || 'https://forge.butterfly-effect.dev';
    const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

    return new Promise<void>((resolve) => {
      const script = document.createElement('script');
      script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=places`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        if (window.google?.maps?.places) {
          placesServiceRef.current = new window.google.maps.places.AutocompleteService();
          setGoogleLoaded(true);
        }
        resolve();
      };
      script.onerror = () => {
        console.error('Failed to load Google Maps script');
        resolve();
      };
      document.head.appendChild(script);
    });
  });

  // Initialize Google Maps on component mount
  useEffect(() => {
    loadGoogleMaps();
  }, [loadGoogleMaps]);
  

  const advisorMutation = trpc.advanced.getInvestmentAdvice.useMutation();
  
  // Favorites mutations
  const addFavorite = trpc.favorites.add.useMutation();
  const [savedAddresses, setSavedAddresses] = useState<Set<string>>(new Set());
  
  // Extract address from message content for saving
  const extractAddressFromMessage = (userMessage: string): string | null => {
    // Check if it's a direct address input
    const inputType = detectInputType(userMessage);
    if (inputType === 'address') return userMessage;
    
    // Check for Zillow URL
    if (inputType === 'zillow_url') {
      const parsed = parseZillowUrl(userMessage);
      return parsed?.address || null;
    }
    
    return null;
  };
  
  // Extract revenue data from AI response
  const extractRevenueFromResponse = (response: string): { annualRevenue?: number; occupancyRate?: number; adr?: number } => {
    const result: { annualRevenue?: number; occupancyRate?: number; adr?: number } = {};
    
    // Extract annual revenue (look for patterns like $XX,XXX/year or Annual Revenue: $XX,XXX)
    const revenueMatch = response.match(/\$([\d,]+)(?:\/year|\/yr|\s*per\s*year|\s*annually)/i) ||
                         response.match(/Annual Revenue[:\s]*\$([\d,]+)/i);
    if (revenueMatch) {
      result.annualRevenue = parseInt(revenueMatch[1].replace(/,/g, ''));
    }
    
    // Extract occupancy rate
    const occMatch = response.match(/(\d+)%\s*(?:occupancy|occ)/i);
    if (occMatch) {
      result.occupancyRate = parseInt(occMatch[1]);
    }
    
    // Extract ADR
    const adrMatch = response.match(/\$([\d,]+)(?:\/night|\s*ADR|\s*per\s*night)/i);
    if (adrMatch) {
      result.adr = parseInt(adrMatch[1].replace(/,/g, ''));
    }
    
    return result;
  };
  
  const handleSaveToFavorites = async (messageIndex: number) => {
    // Find the user message that triggered this response
    const userMessageIndex = messageIndex - 1;
    if (userMessageIndex < 0) return;
    
    const userMessage = messages[userMessageIndex];
    const assistantMessage = messages[messageIndex];
    
    const address = extractAddressFromMessage(userMessage.content);
    if (!address) return;
    
    const revenueData = extractRevenueFromResponse(assistantMessage.content);
    
    try {
      await addFavorite.mutateAsync({
        sessionId,
        address,
        bedrooms: userMessage.filters?.bedrooms,
        bathrooms: userMessage.filters?.bathrooms,
        propertyType: userMessage.filters?.propertyType,
        annualRevenue: revenueData.annualRevenue,
        occupancyRate: revenueData.occupancyRate,
        averageDailyRate: revenueData.adr,
      });
      
      setSavedAddresses(prev => {
        const newSet = new Set(prev);
        newSet.add(address.toLowerCase());
        return newSet;
      });
    } catch (error) {
      console.error('Error saving to favorites:', error);
    }
  };
  
  // Export to PDF function
  const handleExportPDF = (messageIndex: number) => {
    const assistantMessage = messages[messageIndex];
    const userMessageIndex = messageIndex - 1;
    const userMessage = userMessageIndex >= 0 ? messages[userMessageIndex] : null;
    
    // Create PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - 2 * margin;
    let yPosition = 20;
    
    // Helper function to add page break if needed
    const checkPageBreak = (neededSpace: number = 20) => {
      if (yPosition > doc.internal.pageSize.getHeight() - neededSpace) {
        doc.addPage();
        yPosition = 20;
      }
    };
    
    // Helper function to clean emoji and special characters for PDF
    const cleanForPDF = (text: string) => {
      return text
        // Remove emoji and special unicode characters that cause encoding issues
        // Using character ranges that work without the 'u' flag
        .replace(/[\uD800-\uDFFF]/g, '')  // Remove surrogate pairs (emoji)
        .replace(/[\u2600-\u27BF]/g, '')  // Remove misc symbols
        // Replace common symbols with text equivalents
        .replace(/\u2705/g, '[OK]')  // checkmark
        .replace(/\u26a0/g, '[!]')  // warning
        .replace(/\u2b50/g, '*')  // star
        .replace(/\u2192/g, '->')  // arrow
        .replace(/\u2022/g, '-')  // bullet
        .replace(/\u2728/g, '')  // sparkles
        .replace(/\uD83C\uDFE0/g, '')  // house emoji
        // Clean up any remaining problematic characters
        .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '');
    };
    
    // Helper function to parse and render markdown tables
    const renderTable = (tableText: string) => {
      const lines = tableText.trim().split('\n');
      if (lines.length < 2) return;
      
      // Parse header
      const headerCells = lines[0].split('|').filter(c => c.trim()).map(c => cleanForPDF(c.trim()));
      const numCols = headerCells.length;
      if (numCols === 0) return;
      
      // Calculate column widths
      const colWidth = maxWidth / numCols;
      const cellPadding = 2;
      const rowHeight = 8;
      
      checkPageBreak(rowHeight * (lines.length + 1));
      
      // Draw header row with background
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPosition - 5, maxWidth, rowHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      
      headerCells.forEach((cell, i) => {
        const cellX = margin + (i * colWidth) + cellPadding;
        const truncatedCell = cell.length > 20 ? cell.substring(0, 18) + '...' : cell;
        doc.text(truncatedCell, cellX, yPosition);
      });
      yPosition += rowHeight;
      
      // Draw data rows (skip separator line at index 1)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      for (let i = 2; i < lines.length; i++) {
        const cells = lines[i].split('|').filter(c => c.trim()).map(c => cleanForPDF(c.trim()));
        if (cells.length === 0 || cells.every(c => c.match(/^-+$/))) continue;
        
        checkPageBreak(rowHeight);
        
        // Alternate row background
        if (i % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(margin, yPosition - 5, maxWidth, rowHeight, 'F');
        }
        
        cells.forEach((cell, j) => {
          if (j < numCols) {
            const cellX = margin + (j * colWidth) + cellPadding;
            const truncatedCell = cell.length > 20 ? cell.substring(0, 18) + '...' : cell;
            doc.text(truncatedCell, cellX, yPosition);
          }
        });
        yPosition += rowHeight;
      }
      
      yPosition += 5; // Space after table
    };
    
    // Add header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('STR Investment Analysis Report', margin, yPosition);
    yPosition += 12;
    
    // Add date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 8;
    
    // Add divider line
    doc.setDrawColor(201, 169, 98);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 12;
    
    // Add query section
    if (userMessage) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Query:', margin, yPosition);
      yPosition += 6;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const queryLines = doc.splitTextToSize(cleanForPDF(userMessage.content), maxWidth);
      doc.text(queryLines, margin, yPosition);
      yPosition += queryLines.length * 5 + 10;
    }
    
    // Add analysis section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Analysis:', margin, yPosition);
    yPosition += 8;
    
    // Process content - split into sections and handle tables separately
    const content = assistantMessage.content;
    
    // Split content by tables (markdown table pattern)
    const tablePattern = /(\|[^\n]+\|\n\|[-:|\s]+\|\n(?:\|[^\n]+\|\n?)+)/g;
    let lastIndex = 0;
    let match;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    
    while ((match = tablePattern.exec(content)) !== null) {
      // Render text before the table
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        const cleanText = cleanForPDF(textBefore)
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/#{1,6}\s*/g, '')
          .replace(/-{3,}/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        
        if (cleanText) {
          // Check for section headers (lines that were markdown headers)
          const lines = cleanText.split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            
            checkPageBreak(10);
            
            // Detect section headers (all caps or specific patterns)
            if (line.match(/^[A-Z][A-Z\s&]+:?$/) || line.match(/^(PROPERTY|REVENUE|MARKET|COMPETITOR|PROFIT|INVESTMENT|RISK|ROI)/)) {
              yPosition += 3;
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(11);
              doc.text(line, margin, yPosition);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(9);
              yPosition += 7;
            } else {
              const wrappedLines = doc.splitTextToSize(line, maxWidth);
              for (const wrappedLine of wrappedLines) {
                checkPageBreak(6);
                doc.text(wrappedLine, margin, yPosition);
                yPosition += 5;
              }
            }
          }
        }
      }
      
      // Render the table
      renderTable(match[1]);
      lastIndex = match.index + match[0].length;
    }
    
    // Render remaining text after last table
    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex);
      const cleanText = cleanForPDF(remainingText)
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/#{1,6}\s*/g, '')
        .replace(/-{3,}/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/---FOLLOW_UP_QUESTIONS---[\s\S]*?---END_FOLLOW_UP---/g, '')
        .trim();
      
      if (cleanText) {
        const lines = cleanText.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          
          checkPageBreak(10);
          
          if (line.match(/^[A-Z][A-Z\s&]+:?$/) || line.match(/^(PROPERTY|REVENUE|MARKET|COMPETITOR|PROFIT|INVESTMENT|RISK|ROI)/)) {
            yPosition += 3;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text(line, margin, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            yPosition += 7;
          } else {
            const wrappedLines = doc.splitTextToSize(line, maxWidth);
            for (const wrappedLine of wrappedLines) {
              checkPageBreak(6);
              doc.text(wrappedLine, margin, yPosition);
              yPosition += 5;
            }
          }
        }
      }
    }
    
    // Add footer on last page
    yPosition = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text('Powered by Coach Inayah STR Investment Advisor', margin, yPosition);
    
    // Save the PDF
    const address = userMessage ? extractAddressFromMessage(userMessage.content) : null;
    const filename = address 
      ? `str-analysis-${address.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30)}.pdf`
      : `str-analysis-${Date.now()}.pdf`;
    doc.save(filename);
  };

  // Generate Full Report - asks AI for comprehensive analysis
  const handleGenerateFullReport = async (address: string) => {
    const reportPrompt = `Generate a comprehensive investment report for the property at ${address}. Include:

1. **Property Overview** - Basic property details and location
2. **Revenue Analysis** - Annual revenue estimate with monthly breakdown by season (Peak/Shoulder/Slow)
3. **Competition Analysis** - Top 5-10 nearby competitors with their revenue, occupancy, ADR, and distance
4. **Market Position** - How this property compares to market averages
5. **Profit Potential** - Assuming $2,000/month rent, calculate startup costs, monthly expenses breakdown, and profit scenarios (conservative/realistic/optimistic)
6. **Investment Recommendation** - Based on all data, is this a good investment? What are the risks and opportunities?

Format everything in clear tables where appropriate. This is for a beginner investor.`;
    
    await handleSend(reportPrompt);
  };

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
    
    // Show recent searches when input is empty or very short
    if (trimmed.length < 2) {
      if (recentSearches.length > 0 && trimmed.length === 0) {
        const recentSuggestions: AutocompleteSuggestion[] = recentSearches.slice(0, 5).map(search => ({
          type: 'recent' as const,
          text: search.text,
          subtext: `Recent ${search.type}`,
          icon: <History className="w-4 h-4 text-[#C9A962]" />,
          data: search
        }));
        setSuggestions(recentSuggestions);
        // Don't auto-show, only show on focus
      } else {
        setSuggestions([]);
        setShowAutocomplete(false);
      }
      return;
    }

    const timer = setTimeout(async () => {
      const newSuggestions: AutocompleteSuggestion[] = [];
      
      // Check if it's a Zillow URL
      if (trimmed.includes('zillow.com')) {
        const parsed = parseZillowUrl(trimmed);
        newSuggestions.push({
          type: 'address',
          text: trimmed,
          subtext: parsed ? `Analyze: ${parsed.address}` : 'Analyze Zillow property',
          icon: <ExternalLink className="w-4 h-4 text-[#C9A962]" />,
          data: { isZillow: true, parsed }
        });
        setSuggestions(newSuggestions);
        setShowAutocomplete(true);
        return;
      }
      
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

      // Google Places address autocomplete
      if (placesServiceRef.current && trimmed.length >= 3) {
        try {
          const predictions = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve) => {
            placesServiceRef.current!.getPlacePredictions(
              {
                input: trimmed,
                componentRestrictions: { country: 'us' },
                types: ['address']
              },
              (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                  resolve(results);
                } else {
                  resolve([]);
                }
              }
            );
          });

          predictions.slice(0, 5).forEach((prediction) => {
            newSuggestions.push({
              type: 'address',
              text: prediction.description,
              subtext: prediction.structured_formatting?.secondary_text || 'Address',
              icon: <Home className="w-4 h-4 text-[#C9A962]" />,
              data: prediction
            });
          });
        } catch (e) {
          console.error('Google Places error:', e);
        }
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
      
      // If it looks like an address and no Google Places results, add manual address suggestion
      if (/\d+\s+\w+/.test(trimmed) && !newSuggestions.some(s => s.type === 'address')) {
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
    if (filters.bathrooms) parts.push(`${filters.bathrooms} bathroom properties`);
    if (filters.propertyType) parts.push(`${filters.propertyType} type`);
    if (filters.minRating) parts.push(`${filters.minRating}+ star rating`);
    if (filters.priceTier) parts.push(`${filters.priceTier} price tier`);
    if (filters.superhost) parts.push(`superhost only`);
    if (filters.instantBook) parts.push(`instant book enabled`);
    if (filters.professionallyManaged) parts.push(`professionally managed`);
    if (filters.amenities?.length) {
      const amenityLabels = filters.amenities.map(a => {
        const found = amenityOptions.find(opt => opt.value === a);
        return found ? found.label.toLowerCase() : a.replace('has_', '');
      });
      parts.push(`with ${amenityLabels.join(', ')}`);
    }
    
    return parts.length > 0 ? ` Focus on ${parts.join(', ')}.` : '';
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const inputType = detectInputType(messageText);
    
    // Check if this is a property/market search that requires filters
    const isPropertyOrMarketSearch = ['address', 'zillow_url', 'zip_code', 'city'].includes(inputType);
    
    // Require bedrooms, bathrooms, and property type for property/market searches
    if (isPropertyOrMarketSearch) {
      const missingFilters: string[] = [];
      if (!filters.bedrooms) missingFilters.push('Bedrooms');
      if (!filters.bathrooms) missingFilters.push('Bathrooms');
      if (!filters.propertyType) missingFilters.push('Property Type');
      
      if (missingFilters.length > 0) {
        toast.error(`Please select ${missingFilters.join(', ')} before searching`, {
          description: 'These filters help us show you relevant apples-to-apples comparisons',
          duration: 5000,
        });
        setShowFilters(true); // Open the filter panel
        return;
      }
    }
    
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
    
    // Save to recent searches
    const searchType = inputType === 'zillow_url' ? 'address' : 
                       inputType === 'zip_code' ? 'zip' : 
                       inputType === 'city' ? 'market' : 
                       inputType === 'address' ? 'address' : 'question';
    saveRecentSearch(messageText, searchType);

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
        // Parse follow-up questions from the response
        const responseText = result.data.response;
        let content = responseText;
        let followUpQuestions: string[] = [];
        
        // Extract follow-up questions if present
        const followUpMatch = responseText.match(/---FOLLOW_UP_QUESTIONS---([\s\S]*?)---END_FOLLOW_UP---/);
        if (followUpMatch) {
          content = responseText.replace(/---FOLLOW_UP_QUESTIONS---[\s\S]*?---END_FOLLOW_UP---/, '').trim();
          followUpQuestions = followUpMatch[1]
            .split('\n')
            .map(q => q.trim())
            .filter(q => q.length > 0 && q.endsWith('?'));
        }
        
        const assistantMessage: ChatMessage = { 
          role: 'assistant', 
          content,
          followUpQuestions: followUpQuestions.length > 0 ? followUpQuestions : undefined
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
    handleSend(action.fullText || action.text);
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
        <div className="max-w-4xl mx-auto">
          {/* Top bar with favorites button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                showFavorites
                  ? 'bg-[#C9A962] text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              <Heart className={`w-4 h-4 ${showFavorites ? 'fill-current' : ''}`} />
              My Favorites
            </button>
          </div>
          
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C9A962] to-[#a88b4a] mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-semibold text-white mb-2">
              STR Investment Advisor
            </h1>
            <p className="text-white/60 text-sm md:text-base">
              Research properties before you sign the lease
            </p>
          </div>
        </div>
      </div>

      {/* Favorites Panel */}
      {showFavorites && (
        <FavoritesPanel 
          sessionId={sessionId} 
          onClose={() => setShowFavorites(false)}
          onAnalyze={(address) => {
            setInput(address);
            setShowFavorites(false);
            // Trigger analysis
            setTimeout(() => {
              const event = new KeyboardEvent('keydown', { key: 'Enter' });
              inputRef.current?.dispatchEvent(event);
            }, 100);
          }}
          onCompare={(selectedFavorites) => {
            // Build comparison prompt
            const addresses = selectedFavorites.map(f => f.address).join(' vs ');
            const prompt = `Compare these properties side-by-side: ${addresses}. Show a detailed comparison table with revenue, occupancy, ADR, and investment potential for each.`;
            setInput(prompt);
            setShowFavorites(false);
            // Trigger comparison analysis
            setTimeout(() => {
              handleSend(prompt);
            }, 100);
          }}
        />
      )}

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
                      placeholder="Enter address, Zillow link, city, zip code, or ask a question..."
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
                            <span className="text-xs text-white/30 capitalize">{suggestion.type === 'recent' ? 'recent' : suggestion.type}</span>
                          </button>
                        ))}
                        {/* Google Attribution */}
                        {suggestions.some(s => s.type === 'address') && (
                          <div className="px-4 py-2 border-t border-white/10 flex items-center justify-end gap-1">
                            <span className="text-white/30 text-[10px]">Powered by</span>
                            <img 
                              src="https://www.gstatic.com/images/branding/googlelogo/svg/googlelogo_light_clr_74x24px.svg" 
                              alt="Google" 
                              className="h-3 opacity-60"
                            />
                          </div>
                        )}
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
                <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                  {/* Row 1: Basic Filters */}
                  <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                    <FilterDropdown
                      label="Bedrooms"
                      options={bedroomOptions}
                      value={filters.bedrooms}
                      onChange={(v) => setFilters(prev => ({ ...prev, bedrooms: v as number | undefined }))}
                      icon={<BedDouble className="w-3 h-3" />}
                    />
                    <FilterDropdown
                      label="Bathrooms"
                      options={bathroomOptions}
                      value={filters.bathrooms}
                      onChange={(v) => setFilters(prev => ({ ...prev, bathrooms: v as number | undefined }))}
                      icon={<Bath className="w-3 h-3" />}
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
                    <FilterDropdown
                      label="Price Tier"
                      options={priceTierOptions}
                      value={filters.priceTier}
                      onChange={(v) => setFilters(prev => ({ ...prev, priceTier: v as string | undefined }))}
                      icon={<DollarSign className="w-3 h-3" />}
                    />
                  </div>
                  
                  {/* Row 2: Amenity Toggles */}
                  <div className="border-t border-white/10 pt-4">
                    <p className="text-white/50 text-xs mb-3 text-center">Must-Have Amenities</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {amenityOptions.map((amenity) => {
                        const isActive = filters.amenities?.includes(amenity.value);
                        return (
                          <button
                            key={amenity.value}
                            onClick={() => {
                              setFilters(prev => {
                                const current = prev.amenities || [];
                                if (current.includes(amenity.value)) {
                                  return { ...prev, amenities: current.filter(a => a !== amenity.value) };
                                } else {
                                  return { ...prev, amenities: [...current, amenity.value] };
                                }
                              });
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                              isActive
                                ? 'bg-[#C9A962] text-[#0F172A] font-medium'
                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                            }`}
                          >
                            <span>{amenity.icon}</span>
                            <span>{amenity.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Row 3: Toggle Filters */}
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <FilterChip
                        label="⭐ Superhost Only"
                        active={filters.superhost || false}
                        onClick={() => setFilters(prev => ({ ...prev, superhost: !prev.superhost }))}
                      />
                      <FilterChip
                        label="⚡ Instant Book"
                        active={filters.instantBook || false}
                        onClick={() => setFilters(prev => ({ ...prev, instantBook: !prev.instantBook }))}
                      />
                      <FilterChip
                        label="🏢 Pro Managed"
                        active={filters.professionallyManaged || false}
                        onClick={() => setFilters(prev => ({ ...prev, professionallyManaged: !prev.professionallyManaged }))}
                      />
                    </div>
                  </div>
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
                <p className="text-xs text-white/40">Fresh market stats</p>
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
            {messages.map((message, index) => {
              // Check if this is an assistant message with property analysis
              const isAssistant = message.role === 'assistant';
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const prevAddress = prevMessage ? extractAddressFromMessage(prevMessage.content) : null;
              const isSaved = prevAddress ? savedAddresses.has(prevAddress.toLowerCase()) : false;
              
              return (
                <MessageBubble 
                  key={index} 
                  message={message}
                  onSaveToFavorites={isAssistant && prevAddress ? () => handleSaveToFavorites(index) : undefined}
                  onExportPDF={isAssistant ? () => handleExportPDF(index) : undefined}
                  onFollowUpClick={isAssistant ? (question) => handleSend(question) : undefined}
                  onGenerateReport={isAssistant && prevAddress ? () => handleGenerateFullReport(prevAddress) : undefined}
                  isSaved={isSaved}
                />
              );
            })}
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
                {filters.bathrooms && (
                  <span className="text-xs bg-[#C9A962]/20 text-[#C9A962] px-2 py-1 rounded-full flex items-center gap-1">
                    {filters.bathrooms} BA
                    <button onClick={() => setFilters(prev => ({ ...prev, bathrooms: undefined }))} className="hover:text-[#0F172A]">
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
                    {filters.minRating}+ ⭐
                    <button onClick={() => setFilters(prev => ({ ...prev, minRating: undefined }))} className="hover:text-[#0F172A]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.priceTier && (
                  <span className="text-xs bg-[#C9A962]/20 text-[#C9A962] px-2 py-1 rounded-full flex items-center gap-1">
                    {filters.priceTier}
                    <button onClick={() => setFilters(prev => ({ ...prev, priceTier: undefined }))} className="hover:text-[#0F172A]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.superhost && (
                  <span className="text-xs bg-[#C9A962]/20 text-[#C9A962] px-2 py-1 rounded-full flex items-center gap-1">
                    Superhost
                    <button onClick={() => setFilters(prev => ({ ...prev, superhost: undefined }))} className="hover:text-[#0F172A]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.instantBook && (
                  <span className="text-xs bg-[#C9A962]/20 text-[#C9A962] px-2 py-1 rounded-full flex items-center gap-1">
                    Instant Book
                    <button onClick={() => setFilters(prev => ({ ...prev, instantBook: undefined }))} className="hover:text-[#0F172A]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {filters.amenities?.map(amenity => {
                  const found = amenityOptions.find(opt => opt.value === amenity);
                  return (
                    <span key={amenity} className="text-xs bg-[#C9A962]/20 text-[#C9A962] px-2 py-1 rounded-full flex items-center gap-1">
                      {found?.icon} {found?.label || amenity}
                      <button onClick={() => setFilters(prev => ({ ...prev, amenities: prev.amenities?.filter(a => a !== amenity) }))} className="hover:text-[#0F172A]">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
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
                  placeholder="Ask about this property, market, or competitors..."
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
                        <span className="text-xs text-[#0F172A]/30 capitalize">{suggestion.type === 'recent' ? 'recent' : suggestion.type}</span>
                      </button>
                    ))}
                    {/* Google Attribution */}
                    {suggestions.some(s => s.type === 'address') && (
                      <div className="px-4 py-2 border-t border-[#0F172A]/10 flex items-center justify-end gap-1">
                        <span className="text-[#0F172A]/30 text-[10px]">Powered by</span>
                        <img 
                          src="https://www.gstatic.com/images/branding/googlelogo/svg/googlelogo_clr_74x24px.svg" 
                          alt="Google" 
                          className="h-3 opacity-60"
                        />
                      </div>
                    )}
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
              <div className="mt-3 p-3 bg-[#0F172A]/5 rounded-xl">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <FilterDropdown
                    label="Bedrooms"
                    options={bedroomOptions}
                    value={filters.bedrooms}
                    onChange={(v) => setFilters(prev => ({ ...prev, bedrooms: v as number | undefined }))}
                    icon={<BedDouble className="w-3 h-3" />}
                  />
                  <FilterDropdown
                    label="Bathrooms"
                    options={bathroomOptions}
                    value={filters.bathrooms}
                    onChange={(v) => setFilters(prev => ({ ...prev, bathrooms: v as number | undefined }))}
                    icon={<Bath className="w-3 h-3" />}
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
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {amenityOptions.slice(0, 4).map((amenity) => {
                    const isActive = filters.amenities?.includes(amenity.value);
                    return (
                      <button
                        key={amenity.value}
                        onClick={() => {
                          setFilters(prev => {
                            const current = prev.amenities || [];
                            if (current.includes(amenity.value)) {
                              return { ...prev, amenities: current.filter(a => a !== amenity.value) };
                            } else {
                              return { ...prev, amenities: [...current, amenity.value] };
                            }
                          });
                        }}
                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                          isActive
                            ? 'bg-[#C9A962] text-[#0F172A] font-medium'
                            : 'bg-[#0F172A]/10 text-[#0F172A]/70 hover:bg-[#0F172A]/20'
                        }`}
                      >
                        <span>{amenity.icon}</span>
                        <span>{amenity.label}</span>
                      </button>
                    );
                  })}
                  <FilterChip
                    label="⭐ Superhost"
                    active={filters.superhost || false}
                    onClick={() => setFilters(prev => ({ ...prev, superhost: !prev.superhost }))}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-4 text-center">
        <p className="text-white/30 text-xs">
          Powered by Coach Inayah • Real-time analysis
        </p>
      </div>
    </div>
  );
}
