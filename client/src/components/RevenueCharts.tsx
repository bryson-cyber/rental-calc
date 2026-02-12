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
  ReferenceLine,
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
  // Historical data colors
  histBar:     '#94a3b8',  // muted gray for historical bars
  histBarLight:'#cbd5e1',  // lighter gray for below-avg historical
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

// Parse a date string like "2025-05" into { monthIdx, year, shortLabel }
function parseMonthDate(dateStr: string) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dashParts = dateStr.split('-');
  if (dashParts.length >= 2) {
    const year = dashParts[0];
    const monthIdx = parseInt(dashParts[1]) - 1;
    const shortYear = year.slice(2);
    const shortMonth = monthIdx >= 0 && monthIdx < 12 ? monthNames[monthIdx] : dateStr.slice(0, 3);
    return { monthIdx, year, shortLabel: `${shortMonth} '${shortYear}` };
  }
  if (dateStr.includes(' ')) {
    const parts = dateStr.split(' ');
    return { monthIdx: 0, year: parts[1] || '', shortLabel: parts[0]?.slice(0, 3) || dateStr.slice(0, 3) };
  }
  return { monthIdx: 0, year: '', shortLabel: dateStr.length > 3 ? dateStr.slice(0, 3) : dateStr };
}

// Monthly Forecast Bar Chart
interface MonthlyForecastData {
  month: string;
  revenue: number;
  occupancy: number;
  adr?: number;
}

interface HistoricalMonthData {
  date: string;
  revenue: number;
  occupancy?: number;
  adr?: number;
}

interface MonthlyForecastChartProps {
  data: MonthlyForecastData[];
  historicalMonths?: HistoricalMonthData[];
  height?: number;
}

export function MonthlyForecastChart({ data, historicalMonths, height = 300 }: MonthlyForecastChartProps) {
  const chartData = useMemo(() => {
    const combined: Array<{
      shortMonth: string;
      revenue: number;
      occupancyPct: number;
      adr?: number;
      isHistorical: boolean;
      rawDate: string;
    }> = [];

    // Add historical months first (if available)
    if (historicalMonths && historicalMonths.length > 0) {
      for (const m of historicalMonths) {
        const parsed = parseMonthDate(m.date);
        const occ = m.occupancy != null ? (m.occupancy > 1 ? m.occupancy : m.occupancy * 100) : 0;
        combined.push({
          shortMonth: parsed.shortLabel,
          revenue: Math.round(m.revenue),
          occupancyPct: Math.round(occ),
          adr: m.adr,
          isHistorical: true,
          rawDate: m.date,
        });
      }
    }

    // Add forecast months
    for (const m of data) {
      const parsed = parseMonthDate(m.month);
      const occ = m.occupancy > 1 ? m.occupancy : m.occupancy * 100;
      combined.push({
        shortMonth: parsed.shortLabel,
        revenue: Math.round(m.revenue),
        occupancyPct: Math.round(occ),
        adr: m.adr,
        isHistorical: false,
        rawDate: m.month,
      });
    }

    return combined;
  }, [data, historicalMonths]);

  const avgRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0) / chartData.length;
  
  // Find the boundary index between historical and forecast
  const forecastStartIdx = chartData.findIndex(d => !d.isHistorical);
  const forecastStartLabel = forecastStartIdx > 0 ? chartData[forecastStartIdx].shortMonth : null;

  // Custom tooltip for combined view
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CombinedTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0]?.payload;
    if (!entry) return null;
    const dataType = entry.isHistorical ? 'Historical' : 'Forecast';
    return (
      <div className="bg-white rounded-lg shadow-lg border border-[#e2e8f0] p-3 text-xs">
        <p className="font-semibold text-[#0f172a] mb-1.5">{label} <span className="text-[#94a3b8] font-normal">({dataType})</span></p>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.isHistorical ? BRAND.histBar : BRAND.gold }} />
          <span className="text-[#64748b]">Revenue:</span>
          <span className="font-semibold text-[#1e293b]">{formatCurrency(entry.revenue)}</span>
        </div>
        {entry.occupancyPct > 0 && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND.navy }} />
            <span className="text-[#64748b]">Occupancy:</span>
            <span className="font-semibold text-[#1e293b]">{entry.occupancyPct}%</span>
          </div>
        )}
        {entry.adr != null && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BRAND.goldLight }} />
            <span className="text-[#64748b]">ADR:</span>
            <span className="font-semibold text-[#1e293b]">{formatCurrency(entry.adr)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} />
          <XAxis 
            dataKey="shortMonth" 
            tick={{ fill: BRAND.axisText, fontSize: chartData.length > 18 ? 9 : 11 }}
            axisLine={{ stroke: BRAND.warmGrayLt }}
            interval={chartData.length > 24 ? 2 : chartData.length > 18 ? 1 : 0}
            angle={chartData.length > 18 ? -45 : 0}
            textAnchor={chartData.length > 18 ? 'end' : 'middle'}
            height={chartData.length > 18 ? 50 : 30}
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
          <Tooltip content={<CombinedTooltip />} />
          <Legend 
            verticalAlign="top"
            height={28}
            payload={[
              ...(historicalMonths && historicalMonths.length > 0 ? [{ value: 'Historical', type: 'square' as const, color: BRAND.histBar }] : []),
              { value: 'Forecast', type: 'square' as const, color: BRAND.gold },
              { value: 'Occupancy', type: 'line' as const, color: BRAND.navy },
            ]}
          />
          {/* Vertical reference line at forecast boundary */}
          {forecastStartLabel && (
            <ReferenceLine 
              yAxisId="revenue"
              x={forecastStartLabel} 
              stroke={BRAND.navy} 
              strokeDasharray="6 4" 
              strokeWidth={1.5}
              label={{ value: 'Forecast →', position: 'top', fill: BRAND.navy, fontSize: 10, fontWeight: 600 }}
            />
          )}
          <Bar 
            yAxisId="revenue"
            dataKey="revenue" 
            name="Revenue"
            radius={[3, 3, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={entry.isHistorical 
                  ? (entry.revenue >= avgRevenue ? BRAND.histBar : BRAND.histBarLight)
                  : (entry.revenue >= avgRevenue ? BRAND.gold : BRAND.goldMuted)
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
            strokeWidth={2}
            dot={{ fill: BRAND.navy, strokeWidth: 2, r: chartData.length > 24 ? 2 : 3 }}
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

// Seasonality Chart — shows all available months (historical + forecast)
interface SeasonalityChartProps {
  data: MonthlyForecastData[];
  historicalMonths?: HistoricalMonthData[];
  height?: number;
}

export function SeasonalityChart({ data, historicalMonths, height = 200 }: SeasonalityChartProps) {
  const chartData = useMemo(() => {
    const combined: Array<{
      shortMonth: string;
      revenue: number;
      occupancyPct: number;
      adr?: number;
      variance: number;
      season: string;
      isHistorical: boolean;
    }> = [];

    // Combine all months
    const allMonths: Array<{ date: string; revenue: number; occupancy: number; adr?: number; isHistorical: boolean }> = [];
    
    if (historicalMonths && historicalMonths.length > 0) {
      for (const m of historicalMonths) {
        allMonths.push({
          date: m.date,
          revenue: Math.round(m.revenue),
          occupancy: m.occupancy ?? 0,
          adr: m.adr,
          isHistorical: true,
        });
      }
    }
    
    for (const m of data) {
      allMonths.push({
        date: m.month,
        revenue: Math.round(m.revenue),
        occupancy: m.occupancy,
        adr: m.adr,
        isHistorical: false,
      });
    }

    const avgRevenue = allMonths.reduce((sum, d) => sum + d.revenue, 0) / allMonths.length;

    for (const m of allMonths) {
      const parsed = parseMonthDate(m.date);
      const occ = m.occupancy > 1 ? m.occupancy : m.occupancy * 100;
      const variance = ((m.revenue - avgRevenue) / avgRevenue) * 100;
      combined.push({
        shortMonth: parsed.shortLabel,
        revenue: m.revenue,
        occupancyPct: Math.round(occ),
        adr: m.adr,
        variance,
        season: variance > 15 ? 'peak' : variance < -15 ? 'off' : 'shoulder',
        isHistorical: m.isHistorical,
      });
    }

    return combined;
  }, [data, historicalMonths]);

  // Find the boundary for the reference line
  const forecastStartIdx = chartData.findIndex(d => !d.isHistorical);
  const forecastStartLabel = forecastStartIdx > 0 ? chartData[forecastStartIdx].shortMonth : null;

  // Custom tooltip for dual-axis display
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SeasonTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0]?.payload;
    if (!entry) return null;
    const seasonLabel = entry.season === 'peak' ? 'Peak Season' : 
      entry.season === 'off' ? 'Off-Season' : 'Shoulder Season';
    const dataType = entry.isHistorical ? 'Historical' : 'Forecast';
    return (
      <div className="bg-white rounded-lg shadow-lg border border-[#e2e8f0] p-3 text-xs">
        <p className="font-semibold text-[#0f172a] mb-1.5">{label} — {seasonLabel} <span className="text-[#94a3b8] font-normal">({dataType})</span></p>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.isHistorical ? BRAND.histBar : BRAND.gold }} />
          <span className="text-[#64748b]">Revenue:</span>
          <span className="font-semibold text-[#1e293b]">{formatCurrency(entry.revenue)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND.navy }} />
          <span className="text-[#64748b]">Occupancy:</span>
          <span className="font-semibold text-[#1e293b]">{entry.occupancyPct}%</span>
        </div>
        {entry.adr != null && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BRAND.goldLight }} />
            <span className="text-[#64748b]">ADR:</span>
            <span className="font-semibold text-[#1e293b]">{formatCurrency(entry.adr)}</span>
          </div>
        )}
      </div>
    );
  };

  const hasHistorical = historicalMonths && historicalMonths.length > 0;

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: chartData.length > 18 ? 30 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} vertical={false} />
          <XAxis 
            dataKey="shortMonth" 
            tick={{ fill: BRAND.axisText, fontSize: chartData.length > 18 ? 9 : 11 }}
            axisLine={false}
            tickLine={false}
            interval={chartData.length > 24 ? 2 : chartData.length > 18 ? 1 : 0}
            angle={chartData.length > 18 ? -45 : 0}
            textAnchor={chartData.length > 18 ? 'end' : 'middle'}
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
          <Tooltip content={<SeasonTooltip />} />
          <Legend 
            verticalAlign="top" 
            height={28}
            payload={[
              ...(hasHistorical ? [{ value: 'Historical', type: 'square' as const, color: BRAND.histBar }] : []),
              { value: 'Revenue (Forecast)', type: 'square' as const, color: BRAND.gold },
              { value: 'Occupancy', type: 'line' as const, color: BRAND.navy },
            ]}
          />
          {/* Vertical reference line at forecast boundary */}
          {forecastStartLabel && (
            <ReferenceLine 
              yAxisId="revenue"
              x={forecastStartLabel} 
              stroke={BRAND.navy} 
              strokeDasharray="6 4" 
              strokeWidth={1.5}
            />
          )}
          <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" radius={[3, 3, 0, 0]}>
            {chartData.map((entry, index) => {
              let fill: string;
              if (entry.isHistorical) {
                fill = entry.season === 'peak' ? BRAND.histBar : 
                       entry.season === 'off' ? BRAND.histBarLight : '#b0bec5';
              } else {
                fill = entry.season === 'peak' ? BRAND.gold : 
                       entry.season === 'off' ? BRAND.goldPale : BRAND.goldMuted;
              }
              return <Cell key={`cell-${index}`} fill={fill} />;
            })}
          </Bar>
          <Line 
            yAxisId="occupancy"
            type="monotone" 
            dataKey="occupancyPct" 
            name="Occupancy"
            stroke={BRAND.navy}
            strokeWidth={2}
            dot={{ fill: BRAND.navy, r: chartData.length > 24 ? 2 : 3.5, strokeWidth: 0 }}
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
