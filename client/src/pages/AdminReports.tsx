import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  Download, 
  Calendar,
  MapPin,
  Home,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';

interface AnalysisReport {
  id: number;
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  bedrooms: number | null;
  bathrooms: string | null;
  monthlyRent: number | null;
  marketName: string | null;
  // Lead capture fields
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  annualRevenueConservative: number | null;
  annualRevenueRealistic: number | null;
  annualRevenueOptimistic: number | null;
  annualProfitConservative: number | null;
  annualProfitRealistic: number | null;
  annualProfitOptimistic: number | null;
  occupancyRate: string | null;
  averageDailyRate: number | null;
  breakEvenOccupancy: string | null;
  startupCostsMin: number | null;
  startupCostsMax: number | null;
  verdict: string | null;
  confidenceScore: number | null;
  createdAt: string;
  fullAnalysisData: any;
  narrativeReport: any;
  competitorData: any;
}

export default function AdminReports() {
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'createdAt' | 'address' | 'annualRevenueRealistic'>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedReport, setSelectedReport] = useState<AnalysisReport | null>(null);
  const [filterVerdict, setFilterVerdict] = useState<string>('all');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/reports');
      if (!response.ok) {
        throw new Error('Failed to fetch reports');
      }
      const data = await response.json();
      setReports(data.reports || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports
    .filter(report => {
      const matchesSearch = 
        report.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.marketName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesVerdict = filterVerdict === 'all' || report.verdict === filterVerdict;
      
      return matchesSearch && matchesVerdict;
    })
    .sort((a, b) => {
      let aVal: any, bVal: any;
      
      if (sortField === 'createdAt') {
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
      } else if (sortField === 'address') {
        aVal = a.address?.toLowerCase() || '';
        bVal = b.address?.toLowerCase() || '';
      } else if (sortField === 'annualRevenueRealistic') {
        aVal = a.annualRevenueRealistic || 0;
        bVal = b.annualRevenueRealistic || 0;
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getVerdictBadge = (verdict: string | null) => {
    if (!verdict) return null;
    
    const badges: Record<string, { bg: string; text: string; icon: any }> = {
      'GO': { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle },
      'CAUTION': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertTriangle },
      'NO-GO': { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle },
    };
    
    const badge = badges[verdict] || badges['CAUTION'];
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="w-3 h-3" />
        {verdict}
      </span>
    );
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const formatPercent = (value: string | null) => {
    if (!value) return '-';
    return `${parseFloat(value).toFixed(1)}%`;
  };

  if (selectedReport) {
    return (
      <ReportDetail 
        report={selectedReport} 
        onBack={() => setSelectedReport(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back to Calculator</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-xl font-semibold text-gray-900">Admin Reports</h1>
            </div>
            <button
              onClick={fetchReports}
              className="flex items-center gap-2 px-4 py-2 bg-[#C9A962] text-white rounded-lg hover:bg-[#B89952] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Home className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Reports</p>
                <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">GO Verdicts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {reports.filter(r => r.verdict === 'GO').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">CAUTION Verdicts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {reports.filter(r => r.verdict === 'CAUTION').length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">NO-GO Verdicts</p>
                <p className="text-2xl font-bold text-gray-900">
                  {reports.filter(r => r.verdict === 'NO-GO').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by address, city, state, or market..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A962] focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterVerdict}
                onChange={(e) => setFilterVerdict(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A962] focus:border-transparent"
              >
                <option value="all">All Verdicts</option>
                <option value="GO">GO Only</option>
                <option value="CAUTION">CAUTION Only</option>
                <option value="NO-GO">NO-GO Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reports Table */}
        {loading ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
            <div className="w-8 h-8 border-3 border-[#C9A962] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading reports...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchReports}
              className="px-4 py-2 bg-[#C9A962] text-white rounded-lg hover:bg-[#B89952] transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
            <Home className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No reports found</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 px-4 py-2 text-[#C9A962] hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort('createdAt')}
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortField === 'createdAt' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort('address')}
                    >
                      <div className="flex items-center gap-1">
                        Property
                        {sortField === 'address' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort('annualRevenueRealistic')}
                    >
                      <div className="flex items-center gap-1">
                        Revenue
                        {sortField === 'annualRevenueRealistic' && (
                          sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profit
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Verdict
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lead Info
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(report.createdAt), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {format(new Date(report.createdAt), 'h:mm a')}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                              {report.address}
                            </div>
                            <div className="text-xs text-gray-500">
                              {[report.city, report.state].filter(Boolean).join(', ')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {report.bedrooms} BR / {report.bathrooms} BA
                        </div>
                        <div className="text-xs text-gray-400">
                          Rent: {formatCurrency(report.monthlyRent)}/mo
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(report.annualRevenueRealistic)}
                        </div>
                        <div className="text-xs text-gray-400">
                          ADR: {formatCurrency(report.averageDailyRate)} | Occ: {formatPercent(report.occupancyRate)}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${(report.annualProfitRealistic || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(report.annualProfitRealistic)}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getVerdictBadge(report.verdict)}
                        {report.confidenceScore && (
                          <div className="text-xs text-gray-400 mt-1">
                            {report.confidenceScore}/10 confidence
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {report.leadEmail ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {report.leadName || 'No name'}
                            </div>
                            <a href={`mailto:${report.leadEmail}`} className="text-xs text-blue-600 hover:underline">
                              {report.leadEmail}
                            </a>
                            {report.leadPhone && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                <a href={`tel:${report.leadPhone}`} className="hover:underline">{report.leadPhone}</a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No lead info</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#C9A962] hover:bg-[#C9A962]/10 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Report Detail Component
function ReportDetail({ report, onBack }: { report: AnalysisReport; onBack: () => void }) {
  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  };

  const formatPercent = (value: string | number | null | undefined) => {
    if (!value) return '-';
    const numValue = parseFloat(String(value));
    if (isNaN(numValue)) return '-';
    
    // Handle different formats:
    // - Values > 100: cap at 100%
    // - Values > 1: already a percentage (e.g., 80 = 80%)
    // - Values > 0.01: decimal to convert (e.g., 0.80 = 80%)
    // - Values <= 0.01: very small, show with decimal (e.g., 0.008 = 0.8%)
    if (numValue > 100) {
      return '100%';
    } else if (numValue > 1) {
      return `${Math.round(numValue)}%`;
    } else if (numValue > 0.01) {
      return `${Math.round(numValue * 100)}%`;
    } else {
      return `${(numValue * 100).toFixed(1)}%`;
    }
  };

  const getVerdictColor = (verdict: string | null) => {
    if (verdict === 'GO') return 'text-green-600 bg-green-100';
    if (verdict === 'NO-GO') return 'text-red-600 bg-red-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const fullData = report.fullAnalysisData || {};
  const narrative = report.narrativeReport || {};
  const competitors = report.competitorData || [];

  return (
    <div className="min-h-screen bg-[#FDF8F5]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Reports</span>
              </button>
            </div>
            <div className="text-sm text-gray-500">
              Report #{report.id} • {format(new Date(report.createdAt), 'MMM d, yyyy h:mm a')}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Property Header */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{report.address}</h1>
              <div className="flex items-center gap-4 text-gray-600">
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {[report.city, report.state, report.zipCode].filter(Boolean).join(', ')}
                </span>
                <span className="flex items-center gap-1">
                  <Home className="w-4 h-4" />
                  {report.bedrooms} BR / {report.bathrooms} BA
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {formatCurrency(report.monthlyRent)}/mo rent
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`px-4 py-2 rounded-lg font-semibold ${getVerdictColor(report.verdict)}`}>
                {report.verdict || 'PENDING'}
              </div>
              {report.confidenceScore && (
                <div className="text-sm text-gray-500">
                  {report.confidenceScore}/10 confidence
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Annual Revenue</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Conservative</span>
                <span className="font-medium">{formatCurrency(report.annualRevenueConservative)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Realistic</span>
                <span className="font-bold text-lg text-[#C9A962]">{formatCurrency(report.annualRevenueRealistic)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Optimistic</span>
                <span className="font-medium">{formatCurrency(report.annualRevenueOptimistic)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Annual Profit</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Conservative</span>
                <span className={`font-medium ${(report.annualProfitConservative || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(report.annualProfitConservative)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Realistic</span>
                <span className={`font-bold text-lg ${(report.annualProfitRealistic || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(report.annualProfitRealistic)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Optimistic</span>
                <span className={`font-medium ${(report.annualProfitOptimistic || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(report.annualProfitOptimistic)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Key Metrics</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Occupancy Rate</span>
                <span className="font-medium">{formatPercent(report.occupancyRate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average Daily Rate</span>
                <span className="font-medium">{formatCurrency(report.averageDailyRate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Break-Even Occupancy</span>
                <span className="font-medium">{formatPercent(report.breakEvenOccupancy)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Startup Costs</span>
                <span className="font-medium">
                  {formatCurrency(report.startupCostsMin)} - {formatCurrency(report.startupCostsMax)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Narrative */}
        {narrative && narrative.executive_summary && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Executive Summary</h3>
            <div className="prose prose-sm max-w-none">
              {narrative.executive_summary.headline && (
                <h4 className="text-[#C9A962] font-medium mb-2">{narrative.executive_summary.headline}</h4>
              )}
              {narrative.executive_summary.summary && (
                <p className="text-gray-600">{narrative.executive_summary.summary}</p>
              )}
              {narrative.executive_summary.key_insight && (
                <blockquote className="border-l-4 border-[#C9A962] pl-4 italic text-gray-600 mt-4">
                  {narrative.executive_summary.key_insight}
                </blockquote>
              )}
            </div>
          </div>
        )}

        {/* Competitors */}
        {competitors && competitors.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Competitor Analysis ({competitors.length} properties)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Property</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Occupancy</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">ADR</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {competitors.slice(0, 10).map((comp: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{comp.title || `Property ${idx + 1}`}</div>
                        <div className="text-xs text-gray-500">{comp.bedrooms} BR / {comp.bathrooms} BA</div>
                      </td>
                      <td className="px-3 py-2 font-medium">{formatCurrency(comp.revenue)}</td>
                      <td className="px-3 py-2">{formatPercent(comp.occupancy)}</td>
                      <td className="px-3 py-2">{formatCurrency(comp.adr)}</td>
                      <td className="px-3 py-2">{comp.rating ? `${comp.rating} ⭐` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Raw Data (Collapsible) */}
        <details className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <summary className="px-6 py-4 cursor-pointer text-gray-700 font-medium hover:bg-gray-50">
            View Raw Analysis Data (JSON)
          </summary>
          <div className="px-6 pb-6">
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
              {JSON.stringify(fullData, null, 2)}
            </pre>
          </div>
        </details>
      </main>
    </div>
  );
}
