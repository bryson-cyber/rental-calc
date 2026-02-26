/**
 * Step 8: Lease Reader & Addendum Maker
 * Upload a lease → AI analysis → Generate addendum (PDF + email/text)
 * 
 * DESIGN: Matches Coach Inayah brand palette
 */

import { useState, useCallback, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Download,
  Copy,
  Mail,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Eye,
  Sparkles,
  FileCheck,
  Scale,
  Home,
  Clock,
  DollarSign,
  Info,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { motion, AnimatePresence } from 'framer-motion';

// Types matching backend exactly
interface ClauseWithStatus {
  status: string;
  details: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  exactText: string;
}

interface LeaseAnalysis {
  overallGrade: string;
  overallScore: number;
  arbitrageFriendliness: string;
  summaryVerdict: string;
  keyTerms: {
    leaseDuration: string;
    monthlyRent: string;
    securityDeposit: string;
    leaseStartDate: string;
    leaseEndDate: string;
    landlordName: string;
    propertyAddress: string;
    tenantName: string;
  };
  clauses: {
    subletting: ClauseWithStatus;
    shortTermRental: ClauseWithStatus;
    assignment: ClauseWithStatus;
    guestPolicy: {
      status: string;
      details: string;
      riskLevel: 'Low' | 'Medium' | 'High';
      exactText: string;
    };
    earlyTermination: {
      penalty: string;
      noticePeriod: string;
      details: string;
    };
    insurance: {
      required: boolean;
      details: string;
    };
    modifications: {
      allowed: boolean;
      details: string;
    };
  };
  redFlags: Array<{
    title: string;
    description: string;
    severity: 'Critical' | 'Warning' | 'Info';
    recommendation: string;
  }>;
  greenFlags: Array<{
    title: string;
    description: string;
  }>;
  recommendations: Array<{
    priority: 'High' | 'Medium' | 'Low';
    action: string;
    reason: string;
  }>;
  addendumPoints: Array<{
    clause: string;
    suggestedLanguage: string;
    reason: string;
  }>;
}

interface AddendumResult {
  formalText: string;
  emailVersion: {
    subject: string;
    body: string;
  };
  textVersion: string;
  htmlUrl: string;
}

// Grade color mapping
const gradeColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
  'A+': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Excellent for Arbitrage' },
  'A': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Excellent for Arbitrage' },
  'B+': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', label: 'Good — Minor Adjustments Needed' },
  'B': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', label: 'Good — Minor Adjustments Needed' },
  'C+': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Possible — Addendum Required' },
  'C': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Possible — Addendum Required' },
  'D': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'Risky — Major Negotiation Needed' },
  'F': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Not Recommended' },
};

const riskColors: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  'Low': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
  'Medium': { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  'High': { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
};

const severityColors: Record<string, { bg: string; text: string }> = {
  'Critical': { bg: 'bg-red-100', text: 'text-red-700' },
  'Warning': { bg: 'bg-amber-100', text: 'text-amber-700' },
  'Info': { bg: 'bg-blue-100', text: 'text-blue-700' },
};

export default function LeaseReaderStep() {
  // State
  const [step, setStep] = useState<'upload' | 'analyzing' | 'results' | 'addendum'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<LeaseAnalysis | null>(null);
  const [addendum, setAddendum] = useState<AddendumResult | null>(null);
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set());
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [activeAddendumTab, setActiveAddendumTab] = useState<'formal' | 'email' | 'sms'>('formal');
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // tRPC mutations
  const uploadMutation = trpc.leaseReader.uploadLease.useMutation();
  const analyzeMutation = trpc.leaseReader.analyzeLease.useMutation();
  const addendumMutation = trpc.leaseReader.generateAddendum.useMutation();

  // File handling
  const handleFileSelect = useCallback((selectedFile: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Please upload a PDF or image file (JPEG, PNG, WebP)');
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 20MB.');
      return;
    }
    setFile(selectedFile);
    if (selectedFile.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(selectedFile));
    } else {
      setFilePreviewUrl(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Analyze lease
  const handleAnalyze = async () => {
    if (!file) return;
    setStep('analyzing');
    setAnalysisProgress(0);

    try {
      // Upload to S3
      setAnalysisProgress(10);
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setAnalysisProgress(25);
      const uploadResult = await uploadMutation.mutateAsync({
        fileName: file.name,
        fileData,
        fileType: file.type as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp',
      });

      // Analyze with Claude
      setAnalysisProgress(40);
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 3, 90));
      }, 1000);

      const analysisResult = await analyzeMutation.mutateAsync({
        fileUrl: uploadResult.url,
        fileType: uploadResult.fileType,
      });

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      setAnalysis(analysisResult as unknown as LeaseAnalysis);
      setStep('results');
      toast.success('Lease analysis complete!');
    } catch (error: any) {
      console.error('[LeaseReader] Analysis failed:', error);
      toast.error(error.message || 'Failed to analyze lease. Please try again.');
      setStep('upload');
    }
  };

  // Generate addendum
  const handleGenerateAddendum = async () => {
    if (!analysis || !tenantName) {
      toast.error('Please enter your name');
      return;
    }

    try {
      const result = await addendumMutation.mutateAsync({
        analysis: analysis as any,
        tenantName,
        tenantEmail: tenantEmail || undefined,
      });

      setAddendum({
        formalText: result.formalText,
        emailVersion: result.emailVersion,
        textVersion: result.textVersion,
        htmlUrl: result.htmlUrl,
      });
      setStep('addendum');
      toast.success('Addendum generated!');
    } catch (error: any) {
      console.error('[LeaseReader] Addendum generation failed:', error);
      toast.error(error.message || 'Failed to generate addendum. Please try again.');
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Toggle clause expansion
  const toggleClause = (clauseKey: string) => {
    setExpandedClauses(prev => {
      const next = new Set(prev);
      if (next.has(clauseKey)) next.delete(clauseKey);
      else next.add(clauseKey);
      return next;
    });
  };

  // Reset
  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setFilePreviewUrl(null);
    setAnalysis(null);
    setAddendum(null);
    setExpandedClauses(new Set());
    setTenantName('');
    setTenantEmail('');
    setAnalysisProgress(0);
  };

  // ============================================
  // UPLOAD STEP
  // ============================================
  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="border-2 border-dashed border-amber-200 bg-amber-50/30 overflow-hidden">
            <CardContent className="p-0">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer transition-all duration-300 p-8 sm:p-12 text-center ${
                  isDragging ? 'bg-amber-100/60 border-amber-400' : 'hover:bg-amber-50/60'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                    isDragging ? 'bg-amber-200' : 'bg-amber-100'
                  }`}>
                    <Upload className={`w-8 h-8 ${isDragging ? 'text-amber-700' : 'text-amber-600'}`} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-800 font-serif">
                      {isDragging ? 'Drop your lease here' : 'Upload Your Lease'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Drag & drop or click to browse • PDF or Image • Max 20MB
                    </p>
                  </div>
                </div>
              </div>

              {file && (
                <div className="border-t border-amber-200 p-4 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleAnalyze(); }}
                      className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-6"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Analyze Lease
                    </Button>
                  </div>
                  {filePreviewUrl && (
                    <div className="mt-3 rounded-lg overflow-hidden border border-slate-200 max-h-48">
                      <img src={filePreviewUrl} alt="Lease preview" className="w-full object-contain max-h-48" />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                What This Tool Analyzes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Shield, label: 'Subletting & assignment clauses', desc: 'Can you sublet or assign the lease?' },
                  { icon: Home, label: 'Short-term rental restrictions', desc: 'Are STRs explicitly prohibited?' },
                  { icon: AlertTriangle, label: 'Red flags for arbitrage', desc: 'Penalties, restrictions, and risks' },
                  { icon: DollarSign, label: 'Key financial terms', desc: 'Rent, deposit, penalties, fees' },
                  { icon: FileCheck, label: 'Arbitrage friendliness grade', desc: 'A-F rating for STR potential' },
                  { icon: FileText, label: 'Custom addendum generator', desc: 'PDF + email ready to send' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <item.icon className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Your lease is encrypted and processed securely. We do not store or share your lease data after analysis.
          </p>
        </div>
      </div>
    );
  }

  // ============================================
  // ANALYZING STEP
  // ============================================
  if (step === 'analyzing') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-4 border-amber-100" />
          <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" style={{ animationDuration: '1.5s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <FileText className="w-10 h-10 text-amber-600" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-serif font-semibold text-slate-800">Analyzing Your Lease</h3>
          <p className="text-sm text-slate-500 max-w-md">
            {analysisProgress < 25 ? 'Uploading document...' :
             analysisProgress < 40 ? 'Document uploaded. Starting AI analysis...' :
             analysisProgress < 70 ? 'Reading lease clauses and terms...' :
             analysisProgress < 90 ? 'Evaluating arbitrage potential...' :
             'Finalizing analysis...'}
          </p>
        </div>
        <div className="w-full max-w-sm">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: `${analysisProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-xs text-slate-400 text-center mt-2">{analysisProgress}%</p>
        </div>
      </motion.div>
    );
  }

  // ============================================
  // RESULTS STEP
  // ============================================
  if (step === 'results' && analysis) {
    const grade = gradeColors[analysis.overallGrade] || gradeColors['C'];
    
    // Build clause list for display
    const mainClauses: { key: string; label: string; icon: typeof Shield; riskLevel: string; status: string; details: string; exactText: string }[] = [
      { key: 'subletting', label: 'Subletting / Subleasing', icon: Home, ...analysis.clauses.subletting },
      { key: 'shortTermRental', label: 'Short-Term Rental', icon: Clock, ...analysis.clauses.shortTermRental },
      { key: 'assignment', label: 'Assignment', icon: FileCheck, ...analysis.clauses.assignment },
      { key: 'guestPolicy', label: 'Guest Policy', icon: Shield, ...analysis.clauses.guestPolicy },
    ];

    return (
      <div className="space-y-6">
        {/* Grade Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className={`${grade.bg} ${grade.border} border-2`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl ${grade.bg} border-2 ${grade.border} flex items-center justify-center`}>
                    <span className={`text-3xl font-bold font-serif ${grade.text}`}>
                      {analysis.overallGrade}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-serif font-semibold text-slate-800">Arbitrage Friendliness</h3>
                    <p className={`text-sm font-medium ${grade.text}`}>{analysis.arbitrageFriendliness}</p>
                    <p className="text-xs text-slate-500 mt-1">Score: {analysis.overallScore}/100</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset} className="text-slate-600">
                  <RefreshCw className="w-4 h-4 mr-1" />
                  New Lease
                </Button>
              </div>
              <p className="mt-4 text-sm text-slate-700 leading-relaxed">{analysis.summaryVerdict}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Lease Details */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-serif">Lease Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Address', value: analysis.keyTerms.propertyAddress },
                  { label: 'Landlord', value: analysis.keyTerms.landlordName },
                  { label: 'Lease Type', value: analysis.keyTerms.leaseDuration },
                  { label: 'Monthly Rent', value: analysis.keyTerms.monthlyRent },
                  { label: 'Security Deposit', value: analysis.keyTerms.securityDeposit },
                  { label: 'Term', value: `${analysis.keyTerms.leaseStartDate} — ${analysis.keyTerms.leaseEndDate}` },
                ].map((item, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium text-slate-800 mt-1">{item.value || 'Not found'}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Red Flags & Green Flags */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {analysis.redFlags.length > 0 && (
              <Card className="border-red-200 bg-red-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-serif flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4" />
                    Red Flags ({analysis.redFlags.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {analysis.redFlags.map((flag, i) => {
                      const sev = severityColors[flag.severity] || severityColors['Warning'];
                      return (
                        <li key={i} className="text-sm">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className={`${sev.bg} ${sev.text} border-0 text-xs flex-shrink-0`}>
                              {flag.severity}
                            </Badge>
                            <div>
                              <p className="font-medium text-slate-800">{flag.title}</p>
                              <p className="text-slate-600 text-xs mt-0.5">{flag.description}</p>
                              <p className="text-amber-700 text-xs mt-1 italic">→ {flag.recommendation}</p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            {analysis.greenFlags.length > 0 && (
              <Card className="border-emerald-200 bg-emerald-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-serif flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Green Flags ({analysis.greenFlags.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.greenFlags.map((flag, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-600" />
                        <div>
                          <p className="font-medium text-emerald-800">{flag.title}</p>
                          <p className="text-emerald-700 text-xs">{flag.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>

        {/* Clause-by-Clause Analysis */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-serif flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-600" />
                Clause-by-Clause Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mainClauses.map(({ key, label, icon: ClauseIcon, riskLevel, status, details, exactText }) => {
                const risk = riskColors[riskLevel] || riskColors['Medium'];
                const RiskIcon = risk.icon;
                const isExpanded = expandedClauses.has(key);
                
                return (
                  <div key={key} className="border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleClause(key)}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <ClauseIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-800">{label}</span>
                        <Badge variant="outline" className={`${risk.bg} ${risk.text} border-0 text-xs`}>
                          <RiskIcon className="w-3 h-3 mr-1" />
                          {riskLevel} Risk
                        </Badge>
                        <Badge variant="outline" className="bg-slate-100 text-slate-600 border-0 text-xs">
                          {status}
                        </Badge>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
                            {exactText && exactText !== 'Not found in lease' && (
                              <div className="p-3 bg-slate-50 rounded-lg border-l-4 border-l-amber-400">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">From the lease:</p>
                                <p className="text-sm text-slate-700 italic">"{exactText}"</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Analysis:</p>
                              <p className="text-sm text-slate-700">{details}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Additional clauses (simpler display) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Early Termination</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">Penalty: {analysis.clauses.earlyTermination.penalty}</p>
                  <p className="text-xs text-slate-600 mt-0.5">Notice: {analysis.clauses.earlyTermination.noticePeriod}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Insurance</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{analysis.clauses.insurance.required ? 'Required' : 'Not Required'}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{analysis.clauses.insurance.details}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Modifications</p>
                  <p className="text-sm font-medium text-slate-800 mt-1">{analysis.clauses.modifications.allowed ? 'Allowed' : 'Not Allowed'}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{analysis.clauses.modifications.details}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-serif flex items-center gap-2 text-amber-700">
                  <Sparkles className="w-4 h-4" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <Badge variant="outline" className={`flex-shrink-0 text-xs ${
                        rec.priority === 'High' ? 'bg-red-100 text-red-700' :
                        rec.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      } border-0`}>
                        {rec.priority}
                      </Badge>
                      <div>
                        <p className="font-medium text-slate-800">{rec.action}</p>
                        <p className="text-slate-600 text-xs mt-0.5">{rec.reason}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Generate Addendum CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
            <CardContent className="p-6">
              <h3 className="text-lg font-serif font-semibold mb-2">Generate Your Addendum</h3>
              <p className="text-sm text-slate-300 mb-4">
                Create a professional lease addendum requesting permission for short-term rental use,
                tailored to the specific clauses found in your lease.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <Label className="text-slate-300 text-xs">Your Full Name *</Label>
                  <Input
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="John Smith"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Your Email (optional)</Label>
                  <Input
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    placeholder="john@example.com"
                    type="email"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 mt-1"
                  />
                </div>
              </div>
              <Button
                onClick={handleGenerateAddendum}
                disabled={!tenantName || addendumMutation.isPending}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
              >
                {addendumMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><FileText className="w-4 h-4 mr-2" />Generate Addendum</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ============================================
  // ADDENDUM STEP
  // ============================================
  if (step === 'addendum' && addendum && analysis) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-xl font-serif font-semibold text-slate-800">Your Addendum is Ready</h3>
              <p className="text-sm text-slate-500 mt-1">Choose a format below to send to your landlord</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('results')}>
                Back to Analysis
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RefreshCw className="w-4 h-4 mr-1" />
                New Lease
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Format Tabs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            {[
              { key: 'formal' as const, icon: FileText, label: 'Formal Addendum' },
              { key: 'email' as const, icon: Mail, label: 'Email Version' },
              { key: 'sms' as const, icon: MessageSquare, label: 'Text Message' },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setActiveAddendumTab(key)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${
                  activeAddendumTab === key
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Content */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardContent className="p-0">
              {activeAddendumTab === 'formal' && (
                <div>
                  <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-slate-700">Formal Lease Addendum</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(addendum.formalText, 'Addendum')}>
                        <Copy className="w-3.5 h-3.5 mr-1" />Copy
                      </Button>
                      {addendum.htmlUrl && (
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => window.open(addendum.htmlUrl, '_blank')}>
                          <Download className="w-3.5 h-3.5 mr-1" />View / Print PDF
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="p-6 max-h-[500px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
                      {addendum.formalText}
                    </pre>
                  </div>
                </div>
              )}

              {activeAddendumTab === 'email' && (
                <div>
                  <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-slate-700">Email to Landlord</span>
                    </div>
                    <Button variant="outline" size="sm"
                      onClick={() => copyToClipboard(`Subject: ${addendum.emailVersion.subject}\n\n${addendum.emailVersion.body}`, 'Email')}>
                      <Copy className="w-3.5 h-3.5 mr-1" />Copy Email
                    </Button>
                  </div>
                  <div className="p-6 max-h-[500px] overflow-y-auto">
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-500 uppercase tracking-wider">Subject Line</p>
                      <p className="text-sm font-medium text-blue-800 mt-1">{addendum.emailVersion.subject}</p>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
                      {addendum.emailVersion.body}
                    </pre>
                  </div>
                </div>
              )}

              {activeAddendumTab === 'sms' && (
                <div>
                  <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-slate-700">Text Message to Landlord</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(addendum.textVersion, 'Text message')}>
                      <Copy className="w-3.5 h-3.5 mr-1" />Copy Text
                    </Button>
                  </div>
                  <div className="p-6">
                    <div className="max-w-sm mx-auto bg-green-50 rounded-2xl p-4 border border-green-200">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{addendum.textVersion}</p>
                      <p className="text-xs text-slate-400 mt-2 text-right">{addendum.textVersion.length} characters</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tips */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-amber-50/50 border-amber-200">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Tips for Sending to Your Landlord
              </h4>
              <ul className="space-y-1.5 text-xs text-amber-700">
                <li>• Start with the email version — it's the most professional first contact</li>
                <li>• Attach the formal addendum PDF when they express interest</li>
                <li>• Emphasize your insurance coverage and guest screening process</li>
                <li>• Offer a trial period (3-6 months) to reduce their perceived risk</li>
                <li>• Consider offering a small rent increase in exchange for STR permission</li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return null;
}
