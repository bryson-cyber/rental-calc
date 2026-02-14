/**
 * Revenue Charts Component
 * Brand-aligned chart rendering using Recharts
 * Coach Inayah palette: Gold (#C9A962), Navy (#1e293b), warm grays
 */

import { useMemo, useState } from 'react';
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
  // Year-over-Year colors (distinct per year)
  yoyColors: ['#94a3b8', '#C9A962', '#1e293b', '#6366f1'] as string[],
  yoyColorNames: ['gray', 'gold', 'navy', 'indigo'] as string[],
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
  if (!dateStr) return { monthIdx: 0, year: '', shortLabel: 'N/A' };
  
  // Handle "2025-05" or "2025-05-15" format
  const dashParts = dateStr.split('-');
  if (dashParts.length >= 2 && dashParts[0].length === 4) {
    const year = dashParts[0];
    const monthIdx = parseInt(dashParts[1]) - 1;
    const shortYear = year.slice(2);
    const shortMonth = monthIdx >= 0 && monthIdx < 12 ? monthNames[monthIdx] : `M${dashParts[1]}`;
    return { monthIdx: Math.max(0, monthIdx), year, shortLabel: `${shortMonth} '${shortYear}` };
  }
  
  // Handle "May 2025" or "May '25" format
  if (dateStr.includes(' ')) {
    const parts = dateStr.split(' ');
    const monthStr = parts[0] || '';
    const yearStr = parts[1] || '';
    // Try to match month name
    const monthMatch = monthNames.findIndex(m => monthStr.toLowerCase().startsWith(m.toLowerCase()));
    if (monthMatch >= 0) {
      const shortYear = yearStr.length === 4 ? yearStr.slice(2) : yearStr.replace("'", '');
      return { monthIdx: monthMatch, year: yearStr, shortLabel: `${monthNames[monthMatch]} '${shortYear}` };
    }
    return { monthIdx: 0, year: yearStr, shortLabel: `${monthStr.slice(0, 3)} ${yearStr}`.trim() };
  }
  
  // Handle just a year like "2024" — don't truncate to "202"
  if (/^\d{4}$/.test(dateStr)) {
    return { monthIdx: 0, year: dateStr, shortLabel: dateStr };
  }
  
  // Handle month name only like "January" or "Jan"
  const monthMatch = monthNames.findIndex(m => dateStr.toLowerCase().startsWith(m.toLowerCase()));
  if (monthMatch >= 0) {
    return { monthIdx: monthMatch, year: '', shortLabel: monthNames[monthMatch] };
  }
  
  // Fallback: return the full string (don't truncate)
  return { monthIdx: 0, year: '', shortLabel: dateStr.length > 7 ? dateStr.slice(0, 7) : dateStr };
}

// Monthly Forecast Bar Chart — property-specific forecast only
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
  const chartData = useMemo(() => {
    return data.map(m => {
      const parsed = parseMonthDate(m.month);
      const occ = m.occupancy > 1 ? m.occupancy : m.occupancy * 100;
      return {
        shortMonth: parsed.shortLabel,
        revenue: Math.round(m.revenue),
        occupancyPct: Math.round(occ),
        adr: m.adr,
      };
    });
  }, [data]);

  const avgRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0) / (chartData.length || 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ForecastTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0]?.payload;
    if (!entry) return null;
    return (
      <div className="bg-white rounded-lg shadow-lg border border-[#e2e8f0] p-3 text-xs">
        <p className="font-semibold text-[#0f172a] mb-1.5">{label}</p>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BRAND.gold }} />
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
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} />
          <XAxis 
            dataKey="shortMonth" 
            tick={{ fill: BRAND.axisText, fontSize: 11 }}
            axisLine={{ stroke: BRAND.warmGrayLt }}
            interval={0}
          />
          <YAxis 
            yAxisId="revenue"
            tick={{ fill: BRAND.axisText, fontSize: 11 }}
            axisLine={{ stroke: BRAND.warmGrayLt }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <YAxis 
            yAxisId="occupancy"
            orientation="right"
            tick={{ fill: BRAND.axisText, fontSize: 11 }}
            axisLine={{ stroke: BRAND.warmGrayLt }}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
          />
          <Tooltip content={<ForecastTooltip />} />
          <Legend 
            verticalAlign="top"
            height={36}
            wrapperStyle={{ paddingBottom: 8 }}
            payload={[
              { value: 'Projected Revenue', type: 'square' as const, color: BRAND.gold },
              { value: 'Occupancy Rate', type: 'line' as const, color: BRAND.navy },
            ]}
          />
          <Bar 
            yAxisId="revenue"
            dataKey="revenue" 
            name="Revenue"
            radius={[3, 3, 0, 0]}
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
            dot={{ fill: BRAND.navy, strokeWidth: 2, r: 3 }}
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
      shortDate: parseMonthDate(item.date).shortLabel,
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

// Seasonality Chart — aggregates forecast data by calendar month (Jan-Dec) to show seasonal patterns
interface SeasonalityChartProps {
  data: MonthlyForecastData[];
  height?: number;
}

export function SeasonalityChart({ data, height = 280 }: SeasonalityChartProps) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const chartData = useMemo(() => {
    // Group forecast months by calendar month
    const monthBuckets: Record<number, { revenues: number[]; occupancies: number[]; adrs: number[] }> = {};
    for (let i = 0; i < 12; i++) {
      monthBuckets[i] = { revenues: [], occupancies: [], adrs: [] };
    }

    for (const m of data) {
      const parsed = parseMonthDate(m.month);
      const occ = m.occupancy > 1 ? m.occupancy : m.occupancy * 100;
      monthBuckets[parsed.monthIdx].revenues.push(Math.round(m.revenue));
      monthBuckets[parsed.monthIdx].occupancies.push(Math.round(occ));
      if (m.adr) monthBuckets[parsed.monthIdx].adrs.push(m.adr);
    }

    const rows = monthNames.map((name, idx) => {
      const bucket = monthBuckets[idx];
      const avgRev = bucket.revenues.length > 0 
        ? Math.round(bucket.revenues.reduce((a, b) => a + b, 0) / bucket.revenues.length) : 0;
      const avgOcc = bucket.occupancies.length > 0 
        ? Math.round(bucket.occupancies.reduce((a, b) => a + b, 0) / bucket.occupancies.length) : 0;
      const avgAdr = bucket.adrs.length > 0 
        ? Math.round(bucket.adrs.reduce((a, b) => a + b, 0) / bucket.adrs.length) : 0;
      return { month: name, revenue: avgRev, occupancy: avgOcc, adr: avgAdr };
    });

    // Classify seasons
    const allRevenues = rows.map(r => r.revenue).filter(r => r > 0);
    const overallAvg = allRevenues.length > 0 ? allRevenues.reduce((a, b) => a + b, 0) / allRevenues.length : 0;
    return rows.map(row => {
      const variance = overallAvg > 0 ? ((row.revenue - overallAvg) / overallAvg) * 100 : 0;
      const season = variance > 15 ? 'peak' : variance < -15 ? 'off' : 'shoulder';
      return { ...row, season };
    });
  }, [data]);

  const avgRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0) / (chartData.length || 1);

  // Custom tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SeasonTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0]?.payload;
    if (!entry) return null;
    const seasonLabel = entry.season === 'peak' ? 'Peak Season' :
      entry.season === 'off' ? 'Off-Season' : 'Shoulder Season';
    const seasonColor = entry.season === 'peak' ? '#166534' :
      entry.season === 'off' ? '#991b1b' : '#92400e';
    return (
      <div className="bg-white rounded-lg shadow-lg border border-[#e2e8f0] p-3 text-xs min-w-[180px]">
        <p className="font-semibold text-[#0f172a] mb-2">
          {label} — <span style={{ color: seasonColor }}>{seasonLabel}</span>
        </p>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BRAND.gold }} />
          <span className="text-[#64748b]">Revenue:</span>
          <span className="font-semibold text-[#1e293b]">{formatCurrency(entry.revenue)}</span>
        </div>
        {entry.occupancy > 0 && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND.navy }} />
            <span className="text-[#64748b]">Occupancy:</span>
            <span className="font-semibold text-[#1e293b]">{entry.occupancy}%</span>
          </div>
        )}
        {entry.adr > 0 && (
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
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: BRAND.axisText, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="revenue"
            tick={{ fill: BRAND.axisText, fontSize: 10 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
            width={50}
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
            height={36}
            wrapperStyle={{ paddingBottom: 8 }}
            payload={[
              { value: 'Projected Revenue', type: 'square' as const, color: BRAND.gold },
              { value: 'Occupancy Rate', type: 'line' as const, color: BRAND.navy },
            ]}
          />
          <Bar
            yAxisId="revenue"
            dataKey="revenue"
            name="Revenue"
            radius={[3, 3, 0, 0]}
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
            dataKey="occupancy"
            name="Occupancy"
            stroke={BRAND.navy}
            strokeWidth={2.5}
            dot={{ fill: BRAND.navy, r: 4, strokeWidth: 0 }}
            activeDot={{ fill: BRAND.navy, r: 6, strokeWidth: 2, stroke: BRAND.white }}
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

// Market Trends Chart — shows 24-month historical market data (revenue, occupancy, ADR)
interface MarketTrendMonth {
  date: string;
  revenue: number;
  occupancy?: number;
  adr?: number;
}

interface MarketTrendsChartProps {
  data: MarketTrendMonth[];
  height?: number;
}

export function MarketTrendsChart({ data, height = 320 }: MarketTrendsChartProps) {
  const chartData = useMemo(() => {
    return data.map(m => {
      const parsed = parseMonthDate(m.date);
      const occ = m.occupancy != null
        ? (m.occupancy > 1 ? m.occupancy : m.occupancy * 100)
        : 0;
      return {
        shortMonth: parsed.shortLabel,
        revenue: Math.round(m.revenue),
        occupancyPct: Math.round(occ),
        adr: m.adr ? Math.round(m.adr) : undefined,
      };
    });
  }, [data]);

  const avgRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0) / (chartData.length || 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MarketTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0]?.payload;
    if (!entry) return null;
    return (
      <div className="bg-white rounded-lg shadow-lg border border-[#e2e8f0] p-3 text-xs">
        <p className="font-semibold text-[#0f172a] mb-1.5">{label}</p>
        <div className="inline-block bg-[#f1f5f9] text-[#64748b] text-[10px] font-medium px-1.5 py-0.5 rounded mb-2">MARKET DATA</div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BRAND.warmGray }} />
          <span className="text-[#64748b]">Avg Revenue:</span>
          <span className="font-semibold text-[#1e293b]">{formatCurrency(entry.revenue)}</span>
        </div>
        {entry.occupancyPct > 0 && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND.navy }} />
            <span className="text-[#64748b]">Avg Occupancy:</span>
            <span className="font-semibold text-[#1e293b]">{entry.occupancyPct}%</span>
          </div>
        )}
        {entry.adr != null && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BRAND.goldMuted }} />
            <span className="text-[#64748b]">Avg ADR:</span>
            <span className="font-semibold text-[#1e293b]">{formatCurrency(entry.adr)}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} />
          <XAxis
            dataKey="shortMonth"
            tick={{ fill: BRAND.axisText, fontSize: 10 }}
            axisLine={{ stroke: BRAND.warmGrayLt }}
            interval={data.length > 18 ? 1 : 0}
            angle={data.length > 18 ? -45 : 0}
            textAnchor={data.length > 18 ? 'end' : 'middle'}
            height={data.length > 18 ? 50 : 30}
          />
          <YAxis
            yAxisId="revenue"
            tick={{ fill: BRAND.axisText, fontSize: 11 }}
            axisLine={{ stroke: BRAND.warmGrayLt }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <YAxis
            yAxisId="occupancy"
            orientation="right"
            tick={{ fill: BRAND.axisText, fontSize: 11 }}
            axisLine={{ stroke: BRAND.warmGrayLt }}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
          />
          <Tooltip content={<MarketTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ paddingBottom: 8 }}
            payload={[
              { value: 'Market Avg Revenue', type: 'square' as const, color: BRAND.warmGray },
              { value: 'Avg Occupancy', type: 'line' as const, color: BRAND.navy },
            ]}
          />
          <ReferenceLine
            yAxisId="revenue"
            y={avgRevenue}
            stroke={BRAND.warmGray}
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <Bar
            yAxisId="revenue"
            dataKey="revenue"
            name="Revenue"
            radius={[3, 3, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.revenue >= avgRevenue ? BRAND.warmGray : BRAND.warmGrayLt}
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
            dot={{ fill: BRAND.navy, strokeWidth: 2, r: 3 }}
          />
        </ComposedChart>
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
  MarketTrendsChart,
};
