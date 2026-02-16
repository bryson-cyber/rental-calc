/**
 * Voice Bug Report Button Component (Streamlined)
 * 
 * Effortless bug reporting for the admin/developer:
 * 1. Tap the mic button
 * 2. Speak naturally about the bug
 * 3. Tap stop — AI auto-transcribes, parses, and submits
 * 4. Quick confirmation with option to add notes
 * 
 * Auto-captures: current page, active tab, property/market context,
 * recent navigation trail, screen size, browser info.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Mic, 
  Square, 
  Loader2, 
  CheckCircle, 
  Wand2,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';

// Navigation trail tracker — records last 10 page/tab changes
const NAV_TRAIL_KEY = '__bug_report_nav_trail';
const MAX_TRAIL_LENGTH = 10;

function getNavTrail(): string[] {
  try {
    const raw = sessionStorage.getItem(NAV_TRAIL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function pushNavTrail(entry: string) {
  const trail = getNavTrail();
  const last = trail[trail.length - 1];
  if (last === entry) return; // skip duplicates
  trail.push(entry);
  if (trail.length > MAX_TRAIL_LENGTH) trail.shift();
  try {
    sessionStorage.setItem(NAV_TRAIL_KEY, JSON.stringify(trail));
  } catch { /* ignore */ }
}

// Auto-track navigation on every URL change
if (typeof window !== 'undefined') {
  const trackNav = () => {
    const path = window.location.pathname + window.location.search;
    pushNavTrail(`${new Date().toLocaleTimeString()} → ${path}`);
  };
  // Track initial load
  trackNav();
  // Track pushState/replaceState
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) {
    origPush.apply(this, args);
    trackNav();
  };
  history.replaceState = function (...args) {
    origReplace.apply(this, args);
    trackNav();
  };
  window.addEventListener('popstate', trackNav);
}

/** Gather all auto-captured context from the page */
function captureContext() {
  const pagePath = window.location.pathname + window.location.search;
  const browserInfo = navigator.userAgent;
  const screenSize = `${window.innerWidth}x${window.innerHeight}`;
  const navTrail = getNavTrail();
  
  // Try to detect the active tab from the URL or DOM
  const urlParams = new URLSearchParams(window.location.search);
  const activeTab = urlParams.get('tab') || urlParams.get('step') || '';
  
  // Try to detect property/market context from the page
  let propertyAddress = '';
  let city = '';
  let state = '';
  let toolName = '';
  
  // Check for data attributes on the page that components might set
  const contextEl = document.querySelector('[data-bug-context]');
  if (contextEl) {
    propertyAddress = contextEl.getAttribute('data-property-address') || '';
    city = contextEl.getAttribute('data-city') || '';
    state = contextEl.getAttribute('data-state') || '';
    toolName = contextEl.getAttribute('data-tool-name') || '';
  }
  
  // Detect tool from URL path
  if (!toolName) {
    if (pagePath.includes('deal-alert')) toolName = 'Deal Alerts';
    else if (pagePath.includes('tab=validate') || pagePath.includes('step=1')) toolName = 'Deal Validator (Step 1)';
    else if (pagePath.includes('tab=find') || pagePath.includes('step=2')) toolName = 'Opportunity Finder (Step 2)';
    else if (pagePath.includes('tab=estimate') || pagePath.includes('step=3')) toolName = 'Revenue Estimator (Step 3)';
    else if (pagePath.includes('tab=compare') || pagePath.includes('step=4')) toolName = 'Market Comparison (Step 4)';
    else if (pagePath.includes('tab=regulations') || pagePath.includes('step=5')) toolName = 'Regulations Tracker (Step 5)';
    else if (pagePath.includes('report')) toolName = 'Property Report';
    else if (pagePath.includes('admin')) toolName = 'Admin Dashboard';
    else toolName = 'Main App';
  }
  
  // Try to grab visible property/address from the page
  if (!propertyAddress) {
    const addressEl = document.querySelector('[data-address]');
    if (addressEl) {
      propertyAddress = addressEl.getAttribute('data-address') || '';
    }
  }
  
  return {
    pagePath,
    browserInfo,
    screenSize,
    navTrail,
    activeTab,
    propertyAddress,
    city,
    state,
    toolName,
    timestamp: new Date().toISOString(),
  };
}

type ReportStep = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export function VoiceBugReportButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ReportStep>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [parsedSummary, setParsedSummary] = useState<{ title: string; severity: string; feature: string } | null>(null);
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const uploadAudio = trpc.voiceBugReport.uploadAudio.useMutation();
  const transcribeAndParse = trpc.voiceBugReport.transcribeAndParse.useMutation();
  const submitReport = trpc.voiceBugReport.submit.useMutation();
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  const startRecording = useCallback(async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
          ? 'audio/webm;codecs=opus' 
          : 'audio/webm',
      });
      
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        const sizeMB = audioBlob.size / (1024 * 1024);
        if (sizeMB > 16) {
          setError('Recording too long (max 16MB). Try a shorter recording.');
          setStep('error');
          return;
        }
        
        // Auto-process: upload → transcribe → parse → submit
        await processAndSubmit(audioBlob);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setStep('recording');
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('[VoiceBugReport] Microphone error:', err);
      setError('Could not access microphone. Please check permissions.');
      setStep('error');
    }
  }, []);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  
  /** Full auto-pipeline: upload → transcribe → parse → submit */
  const processAndSubmit = async (audioBlob: Blob) => {
    setStep('processing');
    const context = captureContext();
    
    try {
      // Step 1: Upload
      setStatusMessage('Uploading recording...');
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
      
      const uploadResult = await uploadAudio.mutateAsync({
        audioBase64: base64,
        mimeType: 'audio/webm',
        fileName: `bug-report-${Date.now()}.webm`,
      });
      
      if (!uploadResult.success || !uploadResult.audioUrl) {
        throw new Error(uploadResult.error || 'Upload failed');
      }
      
      // Step 2: Transcribe + AI Parse
      setStatusMessage('Transcribing & analyzing...');
      const parseResult = await transcribeAndParse.mutateAsync({
        audioUrl: uploadResult.audioUrl,
        toolName: context.toolName,
        pagePath: context.pagePath,
        propertyAddress: context.propertyAddress,
        city: context.city,
        state: context.state,
      });
      
      if (!parseResult.success) {
        throw new Error(parseResult.error || 'Transcription failed');
      }
      
      const parsed = parseResult.parsed;
      const transcript = parseResult.transcript || '';
      
      if (!parsed || !parsed.title) {
        throw new Error('Could not parse voice into a bug report. Try again with more detail.');
      }
      
      // Step 3: Auto-submit with all context
      setStatusMessage('Submitting report...');
      const result = await submitReport.mutateAsync({
        title: parsed.title,
        description: parsed.description || '',
        stepsToReproduce: parsed.stepsToReproduce 
          ? `${parsed.stepsToReproduce}\n\n--- Auto-captured Navigation Trail ---\n${context.navTrail.join('\n')}`
          : `Navigation Trail:\n${context.navTrail.join('\n')}`,
        expectedBehavior: parsed.expectedBehavior || '',
        actualBehavior: parsed.actualBehavior || '',
        toolName: context.toolName,
        pagePath: context.pagePath,
        propertyAddress: context.propertyAddress,
        city: context.city,
        state: context.state,
        browserInfo: context.browserInfo,
        screenSize: context.screenSize,
        audioUrl: uploadResult.audioUrl,
        transcript,
        severity: parsed.severity || 'medium',
        sessionId: localStorage.getItem('sessionId') || undefined,
      });
      
      if (result.success) {
        setParsedSummary({
          title: parsed.title,
          severity: parsed.severity || 'medium',
          feature: parsed.affectedFeature || context.toolName,
        });
        setStep('done');
        toast.success('Bug report sent!');
      } else {
        throw new Error('Failed to submit');
      }
      
    } catch (err: any) {
      console.error('[VoiceBugReport] Pipeline error:', err);
      setError(err.message || 'Something went wrong. Try again.');
      setStep('error');
    }
  };
  
  const resetAll = () => {
    setStep('idle');
    setRecordingTime(0);
    setStatusMessage('');
    setParsedSummary(null);
    setError('');
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };
  
  // Only show for admin users
  if (!user || user.role !== 'admin') return null;

  return (
    <>
      {/* Floating Voice Bug Report Button */}
      <button
        onClick={() => {
          setOpen(true);
          // Auto-start recording when opening
          if (step === 'idle') {
            setTimeout(() => startRecording(), 300);
          }
        }}
        className="fixed bottom-36 sm:bottom-[11.5rem] right-4 sm:right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        title="Voice Bug Report (Admin Only)"
      >
        <Mic className="w-5 h-5" />
      </button>
      
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen && step === 'recording') {
          stopRecording();
        }
        setOpen(isOpen);
        if (!isOpen) resetAll();
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              {step === 'done' ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Mic className="w-5 h-5 text-amber-600" />
              )}
              {step === 'done' ? 'Report Sent' : 'Voice Bug Report'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {step === 'idle' && 'Tap to start — just describe the bug.'}
              {step === 'recording' && 'Listening... tap stop when done.'}
              {step === 'processing' && statusMessage}
              {step === 'done' && 'Your report has been submitted and the team has been notified.'}
              {step === 'error' && 'Something went wrong.'}
            </DialogDescription>
          </DialogHeader>
          
          {/* IDLE STATE — Big mic button */}
          {step === 'idle' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <button
                onClick={startRecording}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                <Mic className="w-9 h-9" />
              </button>
              <p className="text-sm text-gray-500 text-center">
                Just describe what's broken. Context is captured automatically.
              </p>
            </div>
          )}
          
          {/* RECORDING STATE */}
          {step === 'recording' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="relative">
                <div className="absolute inset-0 w-20 h-20 rounded-full bg-red-400 animate-ping opacity-20" />
                <button
                  onClick={stopRecording}
                  className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg"
                >
                  <Square className="w-7 h-7" />
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xl font-mono font-semibold text-gray-800">
                  {formatTime(recordingTime)}
                </span>
              </div>
              
              {/* Simple waveform */}
              <div className="flex items-end gap-0.5 h-6">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-400 rounded-full transition-all duration-150"
                    style={{
                      height: `${Math.random() * 100}%`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* PROCESSING STATE — auto pipeline */}
          {step === 'processing' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                <Wand2 className="w-8 h-8 text-amber-600 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-800">{statusMessage}</p>
                <p className="text-xs text-gray-400 mt-1">This takes a few seconds</p>
              </div>
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            </div>
          )}
          
          {/* DONE STATE — Quick confirmation */}
          {step === 'done' && parsedSummary && (
            <div className="space-y-3 py-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">{parsedSummary.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityColor(parsedSummary.severity)}`}>
                    {parsedSummary.severity}
                  </span>
                  {parsedSummary.feature && (
                    <span className="text-xs text-gray-500">{parsedSummary.feature}</span>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={resetAll} className="flex-1 gap-1">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Report Another
                </Button>
                <Button size="sm" onClick={() => setOpen(false)} className="flex-1 bg-gray-900 hover:bg-gray-800 text-white">
                  Done
                </Button>
              </div>
            </div>
          )}
          
          {/* ERROR STATE */}
          {step === 'error' && (
            <div className="space-y-3 py-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <Button variant="outline" onClick={resetAll} className="w-full gap-1">
                <RotateCcw className="w-3.5 h-3.5" />
                Try Again
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default VoiceBugReportButton;
