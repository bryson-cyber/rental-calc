import { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { trpc } from '@/lib/trpc';
import { 
  ArrowLeft, 
  Calculator,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  MapPin,
  Home,
  Percent,
  Info,
  BarChart3,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ArbitrageResult {
  property: {
    address: string;
    bedrooms: number;
    bathrooms: number;
    monthly_rent: number;
  };
  projections: {
    annual_str_revenue: number;
    annual_str_revenue_low: number;
    annual_str_revenue_high: number;
    monthly_str_revenue: number;
    break_even_occupancy: number;
    projected_monthly_profit: number;
    projected_annual_profit: number;
    roi_percentage: number;
  };
  risk_assessment: {
    overall_risk: 'low' | 'medium' | 'high';
    seasonality_risk: 'low' | 'medium' | 'high';
    regulation_risk: 'low' | 'medium' | 'high';
    market_saturation: 'low' | 'medium' | 'high';
    factors: string[];
  };
  recommendation: string;
  market_context: {
    market_name: string;
    avg_occupancy: number;
    avg_adr: number;
    avg_revenue: number;
  };
}

const riskColors = {
  low: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-500' },
  high: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500' },
};

const riskIcons = {
  low: <CheckCircle className="w-5 h-5 text-green-500" />,
  medium: <AlertTriangle className="w-5 h-5 text-amber-500" />,
  high: <XCircle className="w-5 h-5 text-red-500" />,
};

function RiskBadge({ risk, label }: { risk: 'low' | 'medium' | 'high'; label: string }) {
  const colors = riskColors[risk];
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colors.bg}`}>
      {riskIcons[risk]}
      <div>
        <div className="text-xs text-[#0F172A]/60">{label}</div>
        <div className={`font-medium capitalize ${colors.text}`}>{risk}</div>
      </div>
    </div>
  );
}

export default function ArbitrageTool() {
  const [address, setAddress] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [bedrooms, setBedrooms] = useState<string>('');
  const [bathrooms, setBathrooms] = useState<string>('');
  const [result, setResult] = useState<ArbitrageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const arbitrageMutation = trpc.advanced.calculateArbitrageFeasibility.useMutation();

  // Setup Google Places Autocomplete
  useEffect(() => {
    if (!inputRef.current || !window.google) return;
    
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place?.formatted_address) {
        setAddress(place.formatted_address);
      }
    });
  }, []);

  const handleCalculate = async () => {
    if (!address || !monthlyRent) return;

    setError(null);
    setResult(null);

    try {
      const response = await arbitrageMutation.mutateAsync({
        address,
        monthlyRent: parseFloat(monthlyRent),
        bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
        bathrooms: bathrooms ? parseFloat(bathrooms) : undefined,
      });

      if (response.success && response.data) {
        setResult(response.data);
      } else {
        setError(response.error || 'Failed to calculate feasibility');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {/* Header */}
      <div className="bg-[#0F172A] text-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#C9A962]/20 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-[#C9A962]" />
            </div>
            <span className="text-[#C9A962] text-sm font-medium uppercase tracking-wider">Arbitrage Calculator</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-serif font-semibold mb-2">
            Rental Arbitrage Feasibility Tool
          </h1>
          <p className="text-white/70 max-w-2xl">
            Evaluate if a rental property is viable for Airbnb arbitrage. Enter the address and monthly rent to see projected revenue, profit, and risk assessment.
          </p>
        </div>
      </div>

      {/* Calculator Form */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="w-5 h-5 text-[#C9A962]" />
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Address */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-1">
                  Property Address *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F172A]/40" />
                  <Input
                    ref={inputRef}
                    placeholder="Enter the property address..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Monthly Rent */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-1">
                  Monthly Rent You'd Pay *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F172A]/40" />
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g., 2500"
                    value={monthlyRent}
                    onChange={(e) => {
                      const val = e.target.value;
                      // Prevent negative values
                      if (val === '' || parseFloat(val) >= 0) {
                        setMonthlyRent(val);
                      }
                    }}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Bedrooms */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-1">
                  Bedrooms (optional)
                </label>
                <Select value={bedrooms} onValueChange={setBedrooms}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bedrooms" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n} Bedroom{n > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bathrooms */}
              <div>
                <label className="block text-sm font-medium text-[#0F172A]/70 mb-1">
                  Bathrooms (optional)
                </label>
                <Select value={bathrooms} onValueChange={setBathrooms}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bathrooms" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n} Bath{n > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleCalculate}
              disabled={!address || !monthlyRent || arbitrageMutation.isPending}
              className="w-full mt-6 bg-[#C9A962] hover:bg-[#b89a55] text-[#0F172A]"
              size="lg"
            >
              {arbitrageMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4 mr-2" />
                  Calculate Feasibility
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="mb-8 border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-500" />
              <p className="text-red-700">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Overall Assessment */}
            <Card className={`mb-6 border-l-4 ${riskColors[result.risk_assessment.overall_risk].border}`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${riskColors[result.risk_assessment.overall_risk].bg}`}>
                    {riskIcons[result.risk_assessment.overall_risk]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-xl font-semibold text-[#0F172A]">
                        {result.risk_assessment.overall_risk === 'low' ? 'Good Investment Potential' :
                         result.risk_assessment.overall_risk === 'medium' ? 'Moderate Risk' : 'High Risk'}
                      </h2>
                      <Badge className={riskColors[result.risk_assessment.overall_risk].bg + ' ' + riskColors[result.risk_assessment.overall_risk].text}>
                        {result.risk_assessment.overall_risk.toUpperCase()} RISK
                      </Badge>
                    </div>
                    <p className="text-[#0F172A]/70">{result.recommendation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Projections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Revenue Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Revenue Projections
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-3xl font-bold text-green-600">
                        {formatCurrency(result.projections.annual_str_revenue)}
                      </div>
                      <div className="text-sm text-green-700">Projected Annual Revenue</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-[#0F172A]/5 rounded-lg">
                        <div className="text-lg font-semibold text-[#0F172A]">
                          {formatCurrency(result.projections.monthly_str_revenue)}
                        </div>
                        <div className="text-xs text-[#0F172A]/60">Monthly Revenue</div>
                      </div>
                      <div className="text-center p-3 bg-[#0F172A]/5 rounded-lg">
                        <div className="text-lg font-semibold text-[#0F172A]">
                          ${Math.round(result.market_context.avg_adr)}
                        </div>
                        <div className="text-xs text-[#0F172A]/60">Avg Daily Rate</div>
                      </div>
                    </div>
                    <div className="text-sm text-[#0F172A]/60 text-center">
                      Range: {formatCurrency(result.projections.annual_str_revenue_low)} - {formatCurrency(result.projections.annual_str_revenue_high)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Profit Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <DollarSign className="w-5 h-5 text-[#C9A962]" />
                    Profit Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className={`text-center p-4 rounded-lg ${result.projections.projected_annual_profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className={`text-3xl font-bold ${result.projections.projected_annual_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(result.projections.projected_annual_profit)}
                      </div>
                      <div className={`text-sm ${result.projections.projected_annual_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        Projected Annual Profit
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-[#0F172A]/5 rounded-lg">
                        <div className={`text-lg font-semibold ${result.projections.projected_monthly_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(result.projections.projected_monthly_profit)}
                        </div>
                        <div className="text-xs text-[#0F172A]/60">Monthly Profit</div>
                      </div>
                      <div className="text-center p-3 bg-[#0F172A]/5 rounded-lg">
                        <div className={`text-lg font-semibold ${result.projections.roi_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {result.projections.roi_percentage.toFixed(0)}%
                        </div>
                        <div className="text-xs text-[#0F172A]/60">ROI</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg text-sm">
                      <Info className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-700">Includes estimated 30% operating expenses</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Break-Even & Risk */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Break-Even */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Percent className="w-5 h-5 text-blue-500" />
                    Break-Even Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center p-4 bg-blue-50 rounded-lg mb-4">
                    <div className="text-3xl font-bold text-blue-600">
                      {result.projections.break_even_occupancy.toFixed(0)}%
                    </div>
                    <div className="text-sm text-blue-700">Break-Even Occupancy</div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#0F172A]/5 rounded-lg">
                    <span className="text-[#0F172A]/60">Market Avg Occupancy</span>
                    <span className="font-semibold">{(result.market_context.avg_occupancy * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-sm text-[#0F172A]/60 mt-3">
                    {result.projections.break_even_occupancy < result.market_context.avg_occupancy * 100 
                      ? '✅ Break-even is below market average - good sign!'
                      : '⚠️ Break-even exceeds market average - higher risk'}
                  </p>
                </CardContent>
              </Card>

              {/* Risk Assessment */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="w-5 h-5 text-purple-500" />
                    Risk Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <RiskBadge risk={result.risk_assessment.overall_risk} label="Overall" />
                    <RiskBadge risk={result.risk_assessment.seasonality_risk} label="Seasonality" />
                    <RiskBadge risk={result.risk_assessment.regulation_risk} label="Regulation" />
                    <RiskBadge risk={result.risk_assessment.market_saturation} label="Saturation" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Risk Factors */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="w-5 h-5 text-[#C9A962]" />
                  Key Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.risk_assessment.factors.map((factor, index) => (
                    <li key={index} className="flex items-start gap-2">
                      {factor.includes('WARNING') ? (
                        <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      ) : factor.includes('Strong') || factor.includes('Comfortable') ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      )}
                      <span className="text-[#0F172A]/80">{factor}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Market Context */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="w-5 h-5 text-[#C9A962]" />
                  Market Context: {result.market_context.market_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-[#0F172A]/5 rounded-lg">
                    <div className="text-xl font-bold text-[#0F172A]">
                      {(result.market_context.avg_occupancy * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-[#0F172A]/60">Avg Occupancy</div>
                  </div>
                  <div className="text-center p-3 bg-[#0F172A]/5 rounded-lg">
                    <div className="text-xl font-bold text-[#0F172A]">
                      ${Math.round(result.market_context.avg_adr)}
                    </div>
                    <div className="text-xs text-[#0F172A]/60">Avg Daily Rate</div>
                  </div>
                  <div className="text-center p-3 bg-[#0F172A]/5 rounded-lg">
                    <div className="text-xl font-bold text-[#0F172A]">
                      {formatCurrency(result.market_context.avg_revenue)}
                    </div>
                    <div className="text-xs text-[#0F172A]/60">Avg Revenue</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Disclaimer */}
        <div className="mt-8 p-4 bg-[#0F172A]/5 rounded-lg text-sm text-[#0F172A]/60">
          <p className="flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Disclaimer:</strong> These projections are estimates based on market data and should not be considered financial advice. 
              Actual results may vary based on property condition, management quality, local regulations, and market conditions. 
              Always consult with a financial advisor and local attorney before entering into any rental arbitrage agreement.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
