import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, TrendingUp, TrendingDown, Percent, DollarSign, Home, BarChart3 } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface HistoricalChartsProps {
  marketId: string;
  marketName: string;
}

export function HistoricalCharts({ 
  marketId, 
  marketName
}: HistoricalChartsProps) {
  const [timeRange, setTimeRange] = useState(24);
  const [activeTab, setActiveTab] = useState('occupancy');

  // Fetch historical data using tRPC
  const { data, isLoading, error } = trpc.compData.getHistoricalData.useQuery({
    marketId,
    numMonths: timeRange,
  });

  const historicalData = data?.data || {
    occupancy: [],
    revenue: [],
    adr: [],
    listings: [],
  };

  // Calculate YoY change
  const calculateYoY = (dataPoints: Array<{ month: string; value: number }>) => {
    if (!dataPoints || dataPoints.length < 13) return null;
    const current = dataPoints[dataPoints.length - 1]?.value || 0;
    const yearAgo = dataPoints[dataPoints.length - 13]?.value || 0;
    if (yearAgo === 0) return null;
    return ((current - yearAgo) / yearAgo) * 100;
  };

  // Get current value
  const getCurrentValue = (dataPoints: Array<{ month: string; value: number }>) => {
    if (!dataPoints || dataPoints.length === 0) return 0;
    return dataPoints[dataPoints.length - 1]?.value || 0;
  };

  // Format month label
  const formatMonth = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const metrics = {
    occupancy: {
      label: 'Booking Rate',
      icon: Percent,
      color: 'oklch(0.55 0.14 75)',  // Gold (brand primary)
      format: (v: number) => `${Math.round(v)}%`,
      yoyFormat: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      tooltip: 'How often properties are booked throughout the year. 60%+ is healthy. If this number is going UP, demand is growing!',
      tooltipFormatter: (value: number) => `Booking Rate: ${Math.round(value)}%`,
      tooltipAfter: (value: number) => {
        if (value >= 70) return 'Excellent booking rate';
        if (value >= 55) return 'Good booking rate';
        return 'Below average';
      },
    },
    revenue: {
      label: 'Annual Income',
      icon: DollarSign,
      color: 'oklch(0.55 0.15 160)',  // Teal
      format: (v: number) => `$${Math.round(v).toLocaleString()}`,
      yoyFormat: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      tooltip: 'Average yearly income hosts earn in this market (before expenses). This is the "gross revenue" you can expect.',
      tooltipFormatter: (value: number) => `Annual Income: $${Math.round(value).toLocaleString()}`,
      tooltipAfter: (value: number) => {
        const monthly = Math.round(value / 12);
        return `≈ $${monthly.toLocaleString()}/month`;
      },
    },
    adr: {
      label: 'Nightly Rate',
      icon: BarChart3,
      color: 'oklch(0.45 0.01 265)',  // Navy
      format: (v: number) => `$${Math.round(v).toLocaleString()}`,
      yoyFormat: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      tooltip: 'Average price per night guests pay. Higher = more premium market. This affects your revenue potential.',
      tooltipFormatter: (value: number) => `Nightly Rate: $${Math.round(value).toLocaleString()}`,
      tooltipAfter: () => '',
    },
    listings: {
      label: 'Competition',
      icon: Home,
      color: 'oklch(0.65 0.12 75)',  // Gold Light
      format: (v: number) => Math.round(v).toLocaleString(),
      yoyFormat: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      tooltip: 'Total active short-term rentals in this market. More listings = more competition. Watch if this is growing faster than demand.',
      tooltipFormatter: (value: number) => `Active Listings: ${Math.round(value).toLocaleString()}`,
      tooltipAfter: () => '',
    },
  };

  // Custom tooltip component for Recharts
  const CustomTooltip = ({ active, payload, label, metricKey }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
    metricKey: string;
  }) => {
    if (!active || !payload || !payload.length) return null;
    const metric = metrics[metricKey as keyof typeof metrics];
    const value = payload[0].value;
    const afterText = metric.tooltipAfter(value);

    return (
      <div className="bg-[oklch(0.15_0.02_265)] text-white px-4 py-3 rounded-lg shadow-lg text-sm">
        <p className="font-bold mb-1">{label}</p>
        <p>{metric.tooltipFormatter(value)}</p>
        {afterText && <p className="mt-1 text-gray-300 text-xs">{afterText}</p>}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[oklch(0.55_0.14_75)]" />
            <span className="ml-3 text-gray-600">Loading historical data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="text-center py-12 text-red-500">
            Failed to load historical data. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Is this market growing or declining?</h3>
            <p className="text-sm text-gray-500 mt-1">Track {marketName}'s performance over time to spot trends</p>
          </div>
          <Select value={String(timeRange)} onValueChange={(v: string) => setTimeRange(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12">12 Months</SelectItem>
              <SelectItem value="24">24 Months</SelectItem>
              <SelectItem value="36">36 Months</SelectItem>
              <SelectItem value="48">48 Months</SelectItem>
              <SelectItem value="60">60 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(metrics).map(([key, metric]) => {
            const dataPoints = historicalData[key as keyof typeof historicalData] || [];
            const currentValue = getCurrentValue(dataPoints);
            const yoyChange = calculateYoY(dataPoints);
            const Icon = metric.icon;

            return (
              <div 
                key={key}
                className={`p-4 rounded-lg border cursor-pointer transition-colors relative group ${
                  activeTab === key 
                    ? 'border-[oklch(0.55_0.14_75)] bg-[oklch(0.55_0.14_75)]/5' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setActiveTab(key)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-500 uppercase tracking-wider cursor-help border-b border-dotted border-gray-400">{metric.label}</span>
                </div>
                <p className="text-xl font-bold text-gray-900">
                  {metric.format(currentValue)}
                </p>
                {yoyChange !== null && (
                  <div className={`flex items-center gap-1 mt-1 text-sm ${
                    yoyChange >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {yoyChange >= 0 ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    {metric.yoyFormat(yoyChange)} vs last year
                  </div>
                )}
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-56 pointer-events-none">
                  <div className="bg-slate-900 text-white text-xs p-3 rounded-lg shadow-lg">
                    {metric.tooltip}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chart Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="occupancy" className="text-xs sm:text-sm">Booking Rate</TabsTrigger>
            <TabsTrigger value="revenue" className="text-xs sm:text-sm">Annual Income</TabsTrigger>
            <TabsTrigger value="adr" className="text-xs sm:text-sm">Nightly Rate</TabsTrigger>
            <TabsTrigger value="listings" className="text-xs sm:text-sm">Competition</TabsTrigger>
          </TabsList>

          {Object.entries(metrics).map(([key, metric]) => {
            const dataPoints = historicalData[key as keyof typeof historicalData] || [];
            const chartData = dataPoints.map((d: { month: string; value: number }) => ({
              month: formatMonth(d.month),
              value: d.value,
            }));
            
            return (
              <TabsContent key={key} value={key} className="mt-0">
                <div className="h-64">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={metric.color} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={metric.color} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.95 0 0)" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }}
                          tickLine={false}
                          axisLine={false}
                          angle={-45}
                          textAnchor="end"
                          height={50}
                        />
                        <YAxis 
                          tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }}
                          tickLine={false}
                          axisLine={false}
                          width={60}
                        />
                        <Tooltip content={<CustomTooltip metricKey={key} />} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={metric.color}
                          strokeWidth={2}
                          fill={`url(#gradient-${key})`}
                          dot={{ r: 3, fill: metric.color, stroke: '#fff', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: metric.color, stroke: '#fff', strokeWidth: 3 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      No data available for this time range
                    </div>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Market Trend Verdict */}
        {(() => {
          const occupancyYoY = calculateYoY(historicalData.occupancy || []);
          const revenueYoY = calculateYoY(historicalData.revenue || []);
          const listingsYoY = calculateYoY(historicalData.listings || []);
          
          // Determine market health based on trends
          let trendStatus: 'growing' | 'stable' | 'declining' | 'unknown' = 'unknown';
          let trendExplanation = '';
          
          if (occupancyYoY !== null && revenueYoY !== null) {
            if (revenueYoY > 5 && occupancyYoY > -5) {
              trendStatus = 'growing';
              trendExplanation = `Revenue is up ${revenueYoY.toFixed(1)}% year-over-year${occupancyYoY > 0 ? ` and booking rates are also climbing (+${occupancyYoY.toFixed(1)}%)` : ''}.`;
            } else if (revenueYoY < -5 && occupancyYoY < -5) {
              trendStatus = 'declining';
              trendExplanation = `Both revenue (${revenueYoY.toFixed(1)}%) and booking rates (${occupancyYoY.toFixed(1)}%) are trending down year-over-year.`;
            } else {
              trendStatus = 'stable';
              trendExplanation = `Revenue is ${revenueYoY >= 0 ? 'up' : 'down'} ${Math.abs(revenueYoY).toFixed(1)}% and booking rates are ${occupancyYoY >= 0 ? 'up' : 'down'} ${Math.abs(occupancyYoY).toFixed(1)}% year-over-year.`;
            }
            
            // Add competition context
            if (listingsYoY !== null && listingsYoY > 10) {
              trendExplanation += ` Competition has increased significantly (+${listingsYoY.toFixed(1)}% more listings).`;
            } else if (listingsYoY !== null && listingsYoY < -5) {
              trendExplanation += ` Competition has decreased (${listingsYoY.toFixed(1)}% fewer listings).`;
            }
          }
          
          if (trendStatus === 'unknown') return null;
          
          return (
            <div className={`mt-6 p-4 rounded-lg border ${
              trendStatus === 'growing' ? 'bg-green-50 border-green-200' :
              trendStatus === 'declining' ? 'bg-red-50 border-red-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full ${
                  trendStatus === 'growing' ? 'bg-green-100' :
                  trendStatus === 'declining' ? 'bg-red-100' :
                  'bg-blue-100'
                }`}>
                  {trendStatus === 'growing' ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : trendStatus === 'declining' ? (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  ) : (
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <h4 className={`font-semibold ${
                    trendStatus === 'growing' ? 'text-green-800' :
                    trendStatus === 'declining' ? 'text-red-800' :
                    'text-blue-800'
                  }`}>
                    This market is {trendStatus === 'growing' ? 'Growing' : trendStatus === 'declining' ? 'Declining' : 'Stable'}
                  </h4>
                  <p className={`text-sm mt-1 ${
                    trendStatus === 'growing' ? 'text-green-700' :
                    trendStatus === 'declining' ? 'text-red-700' :
                    'text-blue-700'
                  }`}>
                    {trendExplanation}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
