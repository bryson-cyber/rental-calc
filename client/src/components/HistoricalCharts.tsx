import { useState, useMemo } from 'react';
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
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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

  // Chart options
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        grid: {
          color: '#F3F4F6',
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            size: 11,
          },
        },
      },
    },
    elements: {
      line: {
        tension: 0.4,
      },
      point: {
        radius: 0,
        hoverRadius: 6,
      },
    },
  }), []);

  // Create chart data for each metric
  const createChartData = (dataPoints: Array<{ month: string; value: number }>, color: string) => ({
    labels: dataPoints.map(d => formatMonth(d.month)),
    datasets: [
      {
        data: dataPoints.map(d => d.value),
        borderColor: color,
        backgroundColor: `${color}20`,
        fill: true,
        borderWidth: 2,
      },
    ],
  });

  const metrics = {
    occupancy: {
      label: 'Booking Rate',
      icon: Percent,
      color: '#3B82F6',
      format: (v: number) => `${Math.round(v)}%`,
      yoyFormat: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      tooltip: 'How often properties are booked throughout the year. 60%+ is healthy. If this number is going UP, demand is growing!',
    },
    revenue: {
      label: 'Annual Income',
      icon: DollarSign,
      color: '#10B981',
      format: (v: number) => `$${Math.round(v).toLocaleString()}`,
      yoyFormat: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      tooltip: 'Average yearly income hosts earn in this market (before expenses). This is the "gross revenue" you can expect.',
    },
    adr: {
      label: 'Nightly Rate',
      icon: BarChart3,
      color: '#8B5CF6',
      format: (v: number) => `$${Math.round(v).toLocaleString()}`,
      yoyFormat: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      tooltip: 'Average price per night guests pay. Higher = more premium market. This affects your revenue potential.',
    },
    listings: {
      label: 'Competition',
      icon: Home,
      color: '#F59E0B',
      format: (v: number) => Math.round(v).toLocaleString(),
      yoyFormat: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      tooltip: 'Total active short-term rentals in this market. More listings = more competition. Watch if this is growing faster than demand.',
    },
  };

  if (isLoading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A962]" />
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
          <Select value={String(timeRange)} onValueChange={(v) => setTimeRange(parseInt(v))}>
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
                    ? 'border-[#C9A962] bg-[#C9A962]/5' 
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
                    {metric.yoyFormat(yoyChange)} YoY
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
            
            return (
              <TabsContent key={key} value={key} className="mt-0">
                <div className="h-64">
                  {dataPoints.length > 0 ? (
                    <Line 
                      data={createChartData(dataPoints, metric.color)} 
                      options={chartOptions}
                    />
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
      </CardContent>
    </Card>
  );
}
