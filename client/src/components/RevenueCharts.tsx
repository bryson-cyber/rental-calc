/**
 * Revenue Charts Component
 * Brand-aligned chart rendering using Recharts
 * Coach Inayah palette: Gold (#C9A962), Navy (#1e293b), warm grays
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend,
  Cell,
  ComposedChart,
} from 'recharts';

// ── Brand Color Palette ──────────────────────────────────────
const BRAND = {
  gold:        '#C9A962',
  goldLight:   '#D4BC82',
  goldMuted:   '#E2D4B0',
  goldPale:    '#F0E8D4',
  navy:        '#1e293b',
  navyLight:   '#334155',
  warmGray:    '#94a3b8',
  warmGrayLt:  '#cbd5e1',
  gridLine:    '#e2e8f0',
  axisText:    '#64748b',
  labelDark:   '#0f172a',
  white:       '#ffffff',
  // Percentile gradient (gold scale)
  pctBottom:   '#E8D5A8',
  pctLow:      '#D4BC82',
  pctMid:      '#C9A962',
  pctHigh:     '#B89A4F',
  pctTop:      '#A68A3C',
};

// Format currency
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Format percent
const formatPercent = (value: number) => {
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(0)}%`;
};

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label, type = 'revenue' }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string; type?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-900 mb-1">{label}</p>
        {payload.map((entry: { color: string; name: string; value: number }, index: number) => (
          <p key={index} style={{ color: entry.color }} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-600">{entry.name}:</span>
            <span className="font-medium">
              {entry.name.toLowerCase().includes('occupancy') 
                ? formatPercent(entry.value)
                : formatCurrency(entry.value)}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Monthly Forecast Bar Chart
interface MonthlyForecastData {
  month: string;
  revenue: number;
  occupancy: number;
  adr?: number;
}

interface MonthlyForecastChartProps {
  data: MonthlyForecastData[];
  height?: number;
}

export function MonthlyForecastChart({ data, height = 300 }: MonthlyForecastChartProps) {
  // Format month labels to be shorter
  const chartData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return data.slice(0, 12).map(item => {
      // Parse month from various formats: "2025-05", "May 2025", "May", etc.
      let shortMonth = item.month;
      const dashParts = item.month.split('-');
      if (dashParts.length >= 2) {
        // Format: "2025-05" or "2025-05-01"
        const monthIdx = parseInt(dashParts[1]) - 1;
        const year = dashParts[0].slice(2); // "25"
        shortMonth = monthIdx >= 0 && monthIdx < 12 ? `${monthNames[monthIdx]} '${year}` : item.month.slice(0, 3);
      } else if (item.month.includes(' ')) {
        // Format: "May 2025"
        shortMonth = item.month.split(' ')[0]?.slice(0, 3) || item.month.slice(0, 3);
      } else if (item.month.length > 3) {
        shortMonth = item.month.slice(0, 3);
      }
      return {
        ...item,
        shortMonth,
        occupancyPct: item.occupancy > 1 ? item.occupancy : item.occupancy * 100,
      };
    });
  }, [data]);

  const avgRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0) / chartData.length;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} />
          <XAxis 
            dataKey="shortMonth" 
            tick={{ fill: BRAND.axisText, fontSize: 12 }}
            axisLine={{ stroke: BRAND.warmGrayLt }}
          />
          <YAxis 
            yAxisId="revenue"
            tick={{ fill: BRAND.axisText, fontSize: 12 }}
            axisLine={{ stroke: BRAND.warmGrayLt }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <YAxis 
            yAxisId="occupancy"
            orientation="right"
            tick={{ fill: BRAND.axisText, fontSize: 12 }}
            axisLine={{ stroke: BRAND.warmGrayLt }}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar 
            yAxisId="revenue"
            dataKey="revenue" 
            name="Revenue"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={entry.revenue >= avgRevenue ? BRAND.gold : BRAND.goldMuted}
              />
            ))}
          </Bar>
          <Line 
            yAxisId="occupancy"
            type="monotone" 
            dataKey="occupancyPct" 
            name="Occupancy"
            stroke={BRAND.navy} 
            strokeWidth={2}
            dot={{ fill: BRAND.navy, strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Revenue Comparison Chart (for percentiles)
interface RevenuePercentileData {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

interface RevenuePercentileChartProps {
  data: RevenuePercentileData;
  yourRevenue?: number;
  height?: number;
}

export function RevenuePercentileChart({ data, yourRevenue, height = 200 }: RevenuePercentileChartProps) {
  const chartData = [
    { name: 'Bottom 10%', revenue: data.p10, fill: BRAND.pctBottom },
    { name: 'Bottom 25%', revenue: data.p25, fill: BRAND.pctLow },
    { name: 'Median',     revenue: data.p50, fill: BRAND.pctMid },
    { name: 'Top 25%',    revenue: data.p75, fill: BRAND.pctHigh },
    { name: 'Top 10%',    revenue: data.p90, fill: BRAND.pctTop },
  ];

  if (yourRevenue) {
    chartData.push({ name: 'Your Estimate', revenue: yourRevenue, fill: BRAND.navy });
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} horizontal={false} />
          <XAxis 
            type="number"
            tick={{ fill: BRAND.axisText, fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value)}
          />
          <YAxis 
            type="category"
            dataKey="name"
            tick={{ fill: BRAND.axisText, fontSize: 12 }}
            width={75}
          />
          <Tooltip 
            formatter={(value: number) => formatCurrency(value)}
            labelStyle={{ color: BRAND.labelDark, fontWeight: 600 }}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Bedroom Performance Chart
interface BedroomPerformanceData {
  bedrooms: number;
  occupancy: number;
  adr: number;
  revenue: number;
  listing_count: number;
}

interface BedroomPerformanceChartProps {
  data: BedroomPerformanceData[];
  highlightBedroom?: number;
  height?: number;
}

export function BedroomPerformanceChart({ data, highlightBedroom, height = 250 }: BedroomPerformanceChartProps) {
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      name: `${item.bedrooms} BR`,
      occupancyPct: item.occupancy > 1 ? item.occupancy : item.occupancy * 100,
      isHighlighted: item.bedrooms === highlightBedroom,
    }));
  }, [data, highlightBedroom]);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} />
          <XAxis 
            dataKey="name" 
            tick={{ fill: BRAND.axisText, fontSize: 12 }}
          />
          <YAxis 
            yAxisId="revenue"
            tick={{ fill: BRAND.axisText, fontSize: 12 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <YAxis 
            yAxisId="occupancy"
            orientation="right"
            tick={{ fill: BRAND.axisText, fontSize: 12 }}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar 
            yAxisId="revenue"
            dataKey="revenue" 
            name="Annual Revenue"
            radius={[4, 4, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={entry.isHighlighted ? BRAND.gold : BRAND.warmGrayLt}
                stroke={entry.isHighlighted ? BRAND.pctTop : 'none'}
                strokeWidth={entry.isHighlighted ? 2 : 0}
              />
            ))}
          </Bar>
          <Line 
            yAxisId="occupancy"
            type="monotone" 
            dataKey="occupancyPct" 
            name="Occupancy"
            stroke={BRAND.gold} 
            strokeWidth={2}
            dot={{ fill: BRAND.gold, strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Historical Trend Chart
interface HistoricalDataPoint {
  date: string;
  value: number;
}

interface HistoricalTrendChartProps {
  data: HistoricalDataPoint[];
  color?: string;
  valueType?: 'currency' | 'percent' | 'number';
  height?: number;
  title?: string;
}

export function HistoricalTrendChart({ 
  data, 
  color = BRAND.gold, 
  valueType = 'currency',
  height = 200,
  title
}: HistoricalTrendChartProps) {
  const chartData = useMemo(() => {
    return data.slice(-12).map(item => ({
      ...item,
      shortDate: item.date.split('-').slice(1).join('/') || item.date.slice(0, 7),
      displayValue: valueType === 'percent' && item.value <= 1 ? item.value * 100 : item.value,
    }));
  }, [data, valueType]);

  const formatValue = (value: number) => {
    switch (valueType) {
      case 'currency':
        return formatCurrency(value);
      case 'percent':
        return formatPercent(value);
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className="w-full" style={{ height }}>
      {title && (
        <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} vertical={false} />
          <XAxis 
            dataKey="shortDate" 
            tick={{ fill: BRAND.warmGray, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fill: BRAND.warmGray, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => {
              if (valueType === 'currency') return `$${(value / 1000).toFixed(0)}k`;
              if (valueType === 'percent') return `${value}%`;
              return value.toString();
            }}
            width={45}
          />
          <Tooltip 
            formatter={(value: number) => [formatValue(value), title || 'Value']}
            labelStyle={{ color: BRAND.labelDark, fontWeight: 600 }}
            contentStyle={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: `1px solid ${BRAND.gridLine}`,
              borderRadius: '8px',
            }}
          />
          <Area 
            type="monotone" 
            dataKey="displayValue" 
            stroke={color} 
            strokeWidth={2}
            fill={`url(#gradient-${color.replace('#', '')})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Seasonality Chart (simple bar visualization)
interface SeasonalityChartProps {
  data: MonthlyForecastData[];
  height?: number;
}

export function SeasonalityChart({ data, height = 200 }: SeasonalityChartProps) {
  const chartData = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const avgRevenue = data.reduce((sum, d) => sum + d.revenue, 0) / data.length;
    return data.slice(0, 12).map(item => {
      const variance = ((item.revenue - avgRevenue) / avgRevenue) * 100;
      // Parse month from various formats: "2025-05", "May 2025", "May", etc.
      let shortMonth = item.month;
      const dashParts = item.month.split('-');
      if (dashParts.length >= 2) {
        const monthIdx = parseInt(dashParts[1]) - 1;
        shortMonth = monthIdx >= 0 && monthIdx < 12 ? monthNames[monthIdx] : item.month.slice(0, 3);
      } else if (item.month.includes(' ')) {
        shortMonth = item.month.split(' ')[0]?.slice(0, 3) || item.month.slice(0, 3);
      } else if (item.month.length > 3) {
        shortMonth = item.month.slice(0, 3);
      }
      // Ensure occupancy is in percentage form (0-100)
      const occupancyPct = item.occupancy > 1 ? item.occupancy : item.occupancy * 100;
      return {
        ...item,
        shortMonth,
        variance,
        occupancyPct: Math.round(occupancyPct),
        season: variance > 15 ? 'peak' : variance < -15 ? 'off' : 'shoulder',
      };
    });
  }, [data]);

  // Custom tooltip for dual-axis display
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0]?.payload;
    if (!entry) return null;
    const seasonLabel = entry.season === 'peak' ? 'Peak Season' : 
      entry.season === 'off' ? 'Off-Season' : 'Shoulder Season';
    return (
      <div className="bg-white rounded-lg shadow-lg border border-[#e2e8f0] p-3 text-xs">
        <p className="font-semibold text-[#0f172a] mb-1.5">{label} — {seasonLabel}</p>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BRAND.gold }} />
          <span className="text-[#64748b]">Revenue:</span>
          <span className="font-semibold text-[#1e293b]">{formatCurrency(entry.revenue)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND.navy }} />
          <span className="text-[#64748b]">Occupancy:</span>
          <span className="font-semibold text-[#1e293b]">{entry.occupancyPct}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} vertical={false} />
          <XAxis 
            dataKey="shortMonth" 
            tick={{ fill: BRAND.axisText, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            yAxisId="revenue"
            hide 
          />
          <YAxis 
            yAxisId="occupancy"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: BRAND.axisText, fontSize: 10 }}
            tickFormatter={(value) => `${value}%`}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="top" 
            height={28}
            formatter={(value: string) => (
              <span style={{ color: BRAND.axisText, fontSize: 11 }}>{value}</span>
            )}
          />
          <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={
                  entry.season === 'peak' ? BRAND.gold : 
                  entry.season === 'off' ? BRAND.goldPale : BRAND.goldMuted
                }
              />
            ))}
          </Bar>
          <Line 
            yAxisId="occupancy"
            type="monotone" 
            dataKey="occupancyPct" 
            name="Occupancy"
            stroke={BRAND.navy}
            strokeWidth={2.5}
            dot={{ fill: BRAND.navy, r: 3.5, strokeWidth: 0 }}
            activeDot={{ fill: BRAND.navy, r: 5, strokeWidth: 2, stroke: BRAND.white }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Competitor Revenue Distribution
interface CompetitorData {
  title: string;
  annual_revenue: number;
  occupancy: number;
  adr: number;
}

interface CompetitorDistributionChartProps {
  data: CompetitorData[];
  threshold?: number;
  height?: number;
}

export function CompetitorDistributionChart({ data, threshold, height = 200 }: CompetitorDistributionChartProps) {
  const chartData = useMemo(() => {
    return data
      .slice(0, 15) // Show up to 15 comps
      .sort((a, b) => b.annual_revenue - a.annual_revenue)
      .map((item, index) => ({
        ...item,
        name: `#${index + 1}`,
        meetsThreshold: threshold ? item.annual_revenue >= threshold : true,
      }));
  }, [data, threshold]);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} vertical={false} />
          <XAxis 
            dataKey="name" 
            tick={{ fill: BRAND.axisText, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fill: BRAND.axisText, fontSize: 11 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label) => `Competitor ${label}`}
          />
          <Bar dataKey="annual_revenue" name="Annual Revenue" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={entry.meetsThreshold ? BRAND.gold : BRAND.warmGrayLt}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default {
  MonthlyForecastChart,
  RevenuePercentileChart,
  BedroomPerformanceChart,
  HistoricalTrendChart,
  SeasonalityChart,
  CompetitorDistributionChart,
};
