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
  const [viewMode, setViewMode] = useState<'timeline' | 'yoy'>('timeline');

  // ── Timeline data (existing linear view) ──
  const timelineData = useMemo(() => {
    const combined: Array<{
      shortMonth: string;
      revenue: number;
      occupancyPct: number;
      adr?: number;
      isHistorical: boolean;
      rawDate: string;
    }> = [];

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

  // ── YoY overlay data ──
  const { yoyData, yearLabels } = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    // Collect all months with their year
    const allEntries: Array<{ year: string; monthIdx: number; revenue: number; occupancy: number; adr?: number; isHistorical: boolean }> = [];

    if (historicalMonths && historicalMonths.length > 0) {
      for (const m of historicalMonths) {
        const parsed = parseMonthDate(m.date);
        const occ = m.occupancy != null ? (m.occupancy > 1 ? m.occupancy : m.occupancy * 100) : 0;
        allEntries.push({ year: parsed.year, monthIdx: parsed.monthIdx, revenue: Math.round(m.revenue), occupancy: Math.round(occ), adr: m.adr, isHistorical: true });
      }
    }
    for (const m of data) {
      const parsed = parseMonthDate(m.month);
      const occ = m.occupancy > 1 ? m.occupancy : m.occupancy * 100;
      allEntries.push({ year: parsed.year, monthIdx: parsed.monthIdx, revenue: Math.round(m.revenue), occupancy: Math.round(occ), adr: m.adr, isHistorical: false });
    }

    // Get unique years sorted
    const years = Array.from(new Set(allEntries.map(e => e.year))).sort();

    // Build 12-month rows with a column per year
    const rows: Array<Record<string, string | number>> = monthNames.map((name, idx) => {
      const row: Record<string, string | number> = { month: name };
      for (const yr of years) {
        const entry = allEntries.find(e => e.year === yr && e.monthIdx === idx);
        row[`rev_${yr}`] = entry ? entry.revenue : 0;
        row[`occ_${yr}`] = entry ? entry.occupancy : 0;
        row[`adr_${yr}`] = entry?.adr ?? 0;
        row[`hist_${yr}`] = entry ? (entry.isHistorical ? 1 : 0) : 0;
      }
      return row;
    });

    return { yoyData: rows, yearLabels: years };
  }, [data, historicalMonths]);

  const avgRevenue = timelineData.reduce((sum, d) => sum + d.revenue, 0) / timelineData.length;
  const forecastStartIdx = timelineData.findIndex(d => !d.isHistorical);
  const forecastStartLabel = forecastStartIdx > 0 ? timelineData[forecastStartIdx].shortMonth : null;
  const hasMultipleYears = yearLabels.length > 1;
  const hasHistorical = historicalMonths && historicalMonths.length > 0;

  // Custom tooltip for timeline view
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CombinedTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0]?.payload;
    if (!entry) return null;
    const dataType = entry.isHistorical ? 'Market Avg' : 'Property Forecast';
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

  // Custom tooltip for YoY view
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const YoYTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0]?.payload;
    if (!entry) return null;
    return (
      <div className="bg-white rounded-lg shadow-lg border border-[#e2e8f0] p-3 text-xs">
        <p className="font-semibold text-[#0f172a] mb-2">{label}</p>
        {yearLabels.map((yr, i) => {
          const rev = entry[`rev_${yr}`] as number;
          const occ = entry[`occ_${yr}`] as number;
          const adr = entry[`adr_${yr}`] as number;
          const isHist = entry[`hist_${yr}`] === 1;
          if (rev === 0 && occ === 0) return null;
          return (
            <div key={yr} className="mb-1.5 last:mb-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BRAND.yoyColors[i % BRAND.yoyColors.length] }} />
                <span className="font-semibold text-[#1e293b]">{yr}{isHist ? ' (Market Avg)' : ' (Property Forecast)'}</span>
              </div>
              <div className="pl-4 text-[#64748b]">
                Revenue: <span className="font-medium text-[#1e293b]">{formatCurrency(rev)}</span>
                {occ > 0 && <> · Occ: <span className="font-medium text-[#1e293b]">{occ}%</span></>}
                {adr > 0 && <> · ADR: <span className="font-medium text-[#1e293b]">{formatCurrency(adr)}</span></>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* View mode toggle — only show if we have multiple years */}
      {hasMultipleYears && (
        <div className="flex items-center justify-end gap-1 mb-3">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 text-xs font-medium rounded-l-lg border transition-colors ${
              viewMode === 'timeline'
                ? 'bg-[#1e293b] text-white border-[#1e293b]'
                : 'bg-white text-[#64748b] border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode('yoy')}
            className={`px-3 py-1.5 text-xs font-medium rounded-r-lg border transition-colors ${
              viewMode === 'yoy'
                ? 'bg-[#1e293b] text-white border-[#1e293b]'
                : 'bg-white text-[#64748b] border-[#e2e8f0] hover:bg-[#f8fafc]'
            }`}
          >
            Year-over-Year
          </button>
        </div>
      )}

      <div style={{ height }}>
        {viewMode === 'timeline' ? (
          /* ── Timeline View ── */
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} />
              <XAxis 
                dataKey="shortMonth" 
                tick={{ fill: BRAND.axisText, fontSize: timelineData.length > 18 ? 9 : 11 }}
                axisLine={{ stroke: BRAND.warmGrayLt }}
                interval={timelineData.length > 24 ? 2 : timelineData.length > 18 ? 1 : 0}
                angle={timelineData.length > 18 ? -45 : 0}
                textAnchor={timelineData.length > 18 ? 'end' : 'middle'}
                height={timelineData.length > 18 ? 50 : 30}
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
                  ...(hasHistorical ? [{ value: 'Market Avg (Historical)', type: 'square' as const, color: BRAND.histBar }] : []),
                  { value: 'Property Forecast', type: 'square' as const, color: BRAND.gold },
                  { value: 'Occupancy', type: 'line' as const, color: BRAND.navy },
                ]}
              />
              {forecastStartLabel && (
                <ReferenceLine 
                  yAxisId="revenue"
                  x={forecastStartLabel} 
                  stroke={BRAND.navy} 
                  strokeDasharray="6 4" 
                  strokeWidth={1.5}
                  label={{ value: 'Your Property →', position: 'top', fill: BRAND.navy, fontSize: 10, fontWeight: 600 }}
                />
              )}
              <Bar 
                yAxisId="revenue"
                dataKey="revenue" 
                name="Revenue"
                radius={[3, 3, 0, 0]}
              >
                {timelineData.map((entry, index) => (
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
                dot={{ fill: BRAND.navy, strokeWidth: 2, r: timelineData.length > 24 ? 2 : 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          /* ── Year-over-Year View ── */
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yoyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BRAND.gridLine} />
              <XAxis 
                dataKey="month" 
                tick={{ fill: BRAND.axisText, fontSize: 12 }}
                axisLine={{ stroke: BRAND.warmGrayLt }}
              />
              <YAxis 
                tick={{ fill: BRAND.axisText, fontSize: 12 }}
                axisLine={{ stroke: BRAND.warmGrayLt }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<YoYTooltip />} />
              <Legend 
                verticalAlign="top"
                height={28}
                payload={yearLabels.map((yr, i) => {
                  // Check if this year has any historical entries
                  const sampleRow = yoyData[0];
                  const isHistYear = sampleRow && sampleRow[`hist_${yr}`] === 1;
                  return {
                    value: isHistYear ? `${yr} (Market)` : `${yr} (Forecast)`,
                    type: 'square' as const,
                    color: BRAND.yoyColors[i % BRAND.yoyColors.length],
                  };
                })}
              />
              {yearLabels.map((yr, i) => (
                <Bar 
                  key={yr}
                  dataKey={`rev_${yr}`}
                  name={yr}
                  fill={BRAND.yoyColors[i % BRAND.yoyColors.length]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {hasHistorical && (
        <p className="text-[10px] text-[#94a3b8] mt-2 text-center italic">
          Historical bars show market-wide averages. Forecast bars show this property's projected revenue.
        </p>
      )}
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

// Seasonality Chart — aggregates data by calendar month (Jan-Dec) to show true seasonal patterns
interface SeasonalityChartProps {
  data: MonthlyForecastData[];
  historicalMonths?: HistoricalMonthData[];
  height?: number;
}

export function SeasonalityChart({ data, historicalMonths, height = 280 }: SeasonalityChartProps) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const { chartData, yearLabels } = useMemo(() => {
    // Collect all months with their year and month index
    const allEntries: Array<{
      year: string;
      monthIdx: number;
      revenue: number;
      occupancy: number;
      adr?: number;
      isHistorical: boolean;
    }> = [];

    if (historicalMonths && historicalMonths.length > 0) {
      for (const m of historicalMonths) {
        const parsed = parseMonthDate(m.date);
        const occ = m.occupancy != null ? (m.occupancy > 1 ? m.occupancy : m.occupancy * 100) : 0;
        allEntries.push({
          year: parsed.year,
          monthIdx: parsed.monthIdx,
          revenue: Math.round(m.revenue),
          occupancy: Math.round(occ),
          adr: m.adr,
          isHistorical: true,
        });
      }
    }

    for (const m of data) {
      const parsed = parseMonthDate(m.month);
      const occ = m.occupancy > 1 ? m.occupancy : m.occupancy * 100;
      allEntries.push({
        year: parsed.year,
        monthIdx: parsed.monthIdx,
        revenue: Math.round(m.revenue),
        occupancy: Math.round(occ),
        adr: m.adr,
        isHistorical: false,
      });
    }

    // Get unique years sorted
    const years = Array.from(new Set(allEntries.map(e => e.year))).sort();

    // Build 12-month rows with a column per year for revenue, and averaged occupancy
    const rows = monthNames.map((name, idx) => {
      const row: Record<string, string | number> = { month: name };
      let totalOcc = 0;
      let occCount = 0;
      let totalAdr = 0;
      let adrCount = 0;

      for (const yr of years) {
        const entry = allEntries.find(e => e.year === yr && e.monthIdx === idx);
        row[`rev_${yr}`] = entry ? entry.revenue : 0;
        if (entry && entry.occupancy > 0) {
          totalOcc += entry.occupancy;
          occCount++;
        }
        if (entry?.adr) {
          totalAdr += entry.adr;
          adrCount++;
        }
      }

      row.avgOccupancy = occCount > 0 ? Math.round(totalOcc / occCount) : 0;
      row.avgAdr = adrCount > 0 ? Math.round(totalAdr / adrCount) : 0;

      // Calculate average revenue across years for season classification
      const revenues = years.map(yr => (row[`rev_${yr}`] as number) || 0).filter(r => r > 0);
      row.avgRevenue = revenues.length > 0 ? Math.round(revenues.reduce((a, b) => a + b, 0) / revenues.length) : 0;

      return row;
    });

    // Classify seasons based on average revenue
    const allAvgRevenues = rows.map(r => r.avgRevenue as number).filter(r => r > 0);
    const overallAvg = allAvgRevenues.length > 0 ? allAvgRevenues.reduce((a, b) => a + b, 0) / allAvgRevenues.length : 0;
    for (const row of rows) {
      const avg = row.avgRevenue as number;
      const variance = overallAvg > 0 ? ((avg - overallAvg) / overallAvg) * 100 : 0;
      row.season = variance > 15 ? 'peak' : variance < -15 ? 'off' : 'shoulder';
    }

    return { chartData: rows, yearLabels: years };
  }, [data, historicalMonths]);

  // Color for each year's bar
  const yearColors: Record<string, string> = {};
  const colorPalette = [BRAND.histBar, BRAND.goldMuted, BRAND.gold, '#6366f1'];
  yearLabels.forEach((yr, i) => {
    yearColors[yr] = colorPalette[i % colorPalette.length];
  });

  // Custom tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SeasonTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0]?.payload;
    if (!entry) return null;
    const seasonLabel = entry.season === 'peak' ? 'Peak Season' :
      entry.season === 'off' ? 'Off-Season' : 'Shoulder Season';
    return (
      <div className="bg-white rounded-lg shadow-lg border border-[#e2e8f0] p-3 text-xs min-w-[180px]">
        <p className="font-semibold text-[#0f172a] mb-2">{label} — {seasonLabel}</p>
        {yearLabels.map((yr) => {
          const rev = entry[`rev_${yr}`] as number;
          if (!rev || rev === 0) return null;
          const isHistYear = historicalMonths && historicalMonths.length > 0 && 
            historicalMonths.some(m => m.date.startsWith(yr));
          return (
            <div key={yr} className="flex items-center gap-1.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: yearColors[yr] }} />
              <span className="text-[#64748b]">{yr}{isHistYear ? ' (Mkt)' : ' (Est)'}:</span>
              <span className="font-semibold text-[#1e293b]">{formatCurrency(rev)}</span>
            </div>
          );
        })}
        <div className="border-t border-[#e2e8f0] mt-1.5 pt-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND.navy }} />
            <span className="text-[#64748b]">Avg Occupancy:</span>
            <span className="font-semibold text-[#1e293b]">{entry.avgOccupancy}%</span>
          </div>
          {entry.avgAdr > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BRAND.goldLight }} />
              <span className="text-[#64748b]">Avg ADR:</span>
              <span className="font-semibold text-[#1e293b]">{formatCurrency(entry.avgAdr)}</span>
            </div>
          )}
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
            height={28}
            payload={[
              ...yearLabels.map(yr => {
                // Check if any entry for this year is historical
                const isHistYear = historicalMonths && historicalMonths.length > 0 && 
                  historicalMonths.some(m => m.date.startsWith(yr));
                return {
                  value: isHistYear ? `${yr} (Market)` : `${yr} (Forecast)`,
                  type: 'square' as const,
                  color: yearColors[yr],
                };
              }),
              { value: 'Avg Occupancy', type: 'line' as const, color: BRAND.navy },
            ]}
          />
          {/* One bar per year, grouped by month */}
          {yearLabels.map((yr) => (
            <Bar
              key={yr}
              yAxisId="revenue"
              dataKey={`rev_${yr}`}
              name={yr}
              fill={yearColors[yr]}
              radius={[3, 3, 0, 0]}
            />
          ))}
          <Line
            yAxisId="occupancy"
            type="monotone"
            dataKey="avgOccupancy"
            name="Avg Occupancy"
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

export default {
  MonthlyForecastChart,
  RevenuePercentileChart,
  BedroomPerformanceChart,
  HistoricalTrendChart,
  SeasonalityChart,
  CompetitorDistributionChart,
};
