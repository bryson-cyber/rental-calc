/**
 * Voice Bug Report Button Component
 * 
 * A floating button that allows the developer to record a voice message
 * describing a bug. The audio is transcribed and parsed into structured
 * bug report fields using AI.
 * 
 * Flow:
 * 1. Tap the mic button to start recording
 * 2. Speak naturally about the bug
 * 3. Tap stop to end recording
 * 4. Audio is uploaded, transcribed, and parsed by AI
 * 5. Review/edit the parsed fields
 * 6. Submit the bug report
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Square, 
  Send, 
  Loader2, 
  CheckCircle, 
  Copy, 
  X, 
  Bug,
  Wand2,
  Edit3,
  Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface VoiceBugReportButtonProps {
  toolName?: string;
  propertyAddress?: string;
  city?: string;
  state?: string;
}

type ReportStep = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'review' | 'submitting' | 'done';

export function VoiceBugReportButton({
  toolName,
  propertyAddress,
  city,
  state,
}: VoiceBugReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ReportStep>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    stepsToReproduce: '',
    expectedBehavior: '',
    actualBehavior: '',
  });
  
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
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Check size
        const sizeMB = audioBlob.size / (1024 * 1024);
        if (sizeMB > 16) {
          setError('Recording too long (max 16MB). Try a shorter recording.');
          setStep('idle');
          return;
        }
        
        // Convert to base64 for upload
        setStep('uploading');
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          
          try {
            // Upload audio
            const uploadResult = await uploadAudio.mutateAsync({
              audioBase64: base64,
              mimeType: 'audio/webm',
              fileName: `bug-report-${Date.now()}.webm`,
            });
            
            if (!uploadResult.success || !uploadResult.audioUrl) {
              setError(uploadResult.error || 'Failed to upload audio');
              setStep('idle');
              return;
            }
            
            setAudioUrl(uploadResult.audioUrl);
            
            // Transcribe and parse
            setStep('transcribing');
            const parseResult = await transcribeAndParse.mutateAsync({
              audioUrl: uploadResult.audioUrl,
              toolName,
              pagePath: window.location.pathname,
              propertyAddress,
              city,
              state,
            });
            
            if (!parseResult.success) {
              setError(parseResult.error || 'Failed to transcribe audio');
              setStep('idle');
              return;
            }
            
            setTranscript(parseResult.transcript || '');
            
            if (parseResult.parsed) {
              setFormData({
                title: parseResult.parsed.title || '',
                description: parseResult.parsed.description || '',
                stepsToReproduce: parseResult.parsed.stepsToReproduce || '',
                expectedBehavior: parseResult.parsed.expectedBehavior || '',
                actualBehavior: parseResult.parsed.actualBehavior || '',
              });
            }
            
            setStep('review');
          } catch (err) {
            console.error('[VoiceBugReport] Error:', err);
            setError('Failed to process recording. Please try again.');
            setStep('idle');
          }
        };
        reader.readAsDataURL(audioBlob);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second
      setStep('recording');
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('[VoiceBugReport] Microphone error:', err);
      setError('Could not access microphone. Please check permissions.');
      setStep('idle');
    }
  }, [toolName, propertyAddress, city, state, uploadAudio, transcribeAndParse]);
  
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  
  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a title for the bug report');
      return;
    }
    
    setStep('submitting');
    
    try {
      const result = await submitReport.mutateAsync({
        ...formData,
        toolName,
        pagePath: window.location.pathname + window.location.search,
        propertyAddress,
        city,
        state,
        browserInfo: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        audioUrl,
        transcript,
        sessionId: localStorage.getItem('sessionId') || undefined,
      });
      
      if (result.success && result.shareUrl) {
        setShareUrl(result.shareUrl);
        setStep('done');
        toast.success('Voice bug report submitted!');
      } else {
        setError('Failed to submit report');
        setStep('review');
      }
    } catch (err) {
      setError('Failed to submit report');
      setStep('review');
    }
  };
  
  const resetAll = () => {
    setStep('idle');
    setRecordingTime(0);
    setTranscript('');
    setAudioUrl('');
    setShareUrl('');
    setError('');
    setFormData({
      title: '',
      description: '',
      stepsToReproduce: '',
      expectedBehavior: '',
      actualBehavior: '',
    });
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <>
      {/* Floating Voice Bug Report Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-20 z-50 bg-white shadow-lg hover:bg-amber-50 border-amber-300 text-amber-700 gap-2"
        title="Voice Bug Report"
      >
        <Mic className="w-4 h-4" />
        <span className="hidden sm:inline">Voice Report</span>
      </Button>
      
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen && step === 'recording') {
          stopRecording();
        }
        setOpen(isOpen);
        if (!isOpen) resetAll();
      }}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step === 'done' ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Mic className="w-5 h-5 text-amber-600" />
              )}
              {step === 'done' ? 'Report Submitted!' : 'Voice Bug Report'}
            </DialogTitle>
            <DialogDescription>
              {step === 'idle' && 'Tap the microphone to describe the bug with your voice.'}
              {step === 'recording' && 'Speak naturally about what went wrong...'}
              {step === 'uploading' && 'Uploading your recording...'}
              {step === 'transcribing' && 'AI is transcribing and parsing your report...'}
              {step === 'review' && 'Review and edit the parsed bug report before submitting.'}
              {step === 'submitting' && 'Submitting your bug report...'}
              {step === 'done' && 'Your voice bug report has been saved.'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Error Display */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {/* IDLE STATE - Show mic button */}
          {step === 'idle' && (
            <div className="flex flex-col items-center gap-6 py-8">
              <button
                onClick={startRecording}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                <Mic className="w-10 h-10" />
              </button>
              <p className="text-sm text-gray-500 text-center max-w-xs">
                Tap to start recording. Describe the bug — what you did, what happened, and what should have happened.
              </p>
              
              {/* Context info */}
              {(toolName || propertyAddress || city) && (
                <div className="w-full p-3 bg-gray-50 rounded-lg text-sm">
                  <p className="font-medium text-gray-700 mb-1">Auto-captured context:</p>
                  <ul className="space-y-0.5 text-gray-500">
                    {toolName && <li>Tool: {toolName}</li>}
                    {propertyAddress && <li>Property: {propertyAddress}</li>}
                    {city && state && <li>Location: {city}, {state}</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* RECORDING STATE - Show waveform and stop button */}
          {step === 'recording' && (
            <div className="flex flex-col items-center gap-6 py-8">
              {/* Pulsing recording indicator */}
              <div className="relative">
                <div className="absolute inset-0 w-24 h-24 rounded-full bg-red-400 animate-ping opacity-20" />
                <button
                  onClick={stopRecording}
                  className="relative w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
                >
                  <Square className="w-8 h-8" />
                </button>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-2xl font-mono font-semibold text-gray-800">
                  {formatTime(recordingTime)}
                </span>
              </div>
              
              <p className="text-sm text-gray-500 text-center">
                Recording... Tap the stop button when you're done.
              </p>
              
              {/* Audio level visualization */}
              <div className="flex items-end gap-1 h-8">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-amber-400 rounded-full transition-all duration-150"
                    style={{
                      height: `${Math.random() * 100}%`,
                      animationDelay: `${i * 50}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* UPLOADING / TRANSCRIBING STATE */}
          {(step === 'uploading' || step === 'transcribing') && (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center">
                {step === 'uploading' ? (
                  <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
                ) : (
                  <Wand2 className="w-10 h-10 text-amber-600 animate-pulse" />
                )}
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-gray-800">
                  {step === 'uploading' ? 'Uploading audio...' : 'AI is analyzing your report...'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {step === 'uploading' 
                    ? 'Sending your recording to the server' 
                    : 'Transcribing speech and extracting bug details'}
                </p>
              </div>
            </div>
          )}
          
          {/* REVIEW STATE - Show parsed fields */}
          {step === 'review' && (
            <div className="space-y-4 py-2">
              {/* Transcript preview */}
              {transcript && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Volume2 className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">Voice Transcript</span>
                  </div>
                  <p className="text-sm text-amber-900 italic">"{transcript}"</p>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Edit3 className="w-4 h-4" />
                <span>Review and edit the AI-parsed fields below:</span>
              </div>
              
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="v-title" className="text-sm font-medium">Bug Title *</Label>
                <Input
                  id="v-title"
                  placeholder="Brief description of the issue"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              
              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="v-desc" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="v-desc"
                  placeholder="What happened?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              
              {/* Steps to Reproduce */}
              <div className="space-y-1.5">
                <Label htmlFor="v-steps" className="text-sm font-medium">Steps to Reproduce</Label>
                <Textarea
                  id="v-steps"
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                  value={formData.stepsToReproduce}
                  onChange={(e) => setFormData({ ...formData, stepsToReproduce: e.target.value })}
                  rows={3}
                />
              </div>
              
              {/* Expected vs Actual */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="v-expected" className="text-sm font-medium">Expected</Label>
                  <Textarea
                    id="v-expected"
                    placeholder="What should happen?"
                    value={formData.expectedBehavior}
                    onChange={(e) => setFormData({ ...formData, expectedBehavior: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="v-actual" className="text-sm font-medium">Actual</Label>
                  <Textarea
                    id="v-actual"
                    placeholder="What actually happened?"
                    value={formData.actualBehavior}
                    onChange={(e) => setFormData({ ...formData, actualBehavior: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              
              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={resetAll} className="flex-1">
                  Start Over
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 text-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Report
                </Button>
              </div>
            </div>
          )}
          
          {/* SUBMITTING STATE */}
          {step === 'submitting' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />
              <p className="text-gray-600">Submitting your bug report...</p>
            </div>
          )}
          
          {/* DONE STATE */}
          {step === 'done' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              {shareUrl && (
                <div className="space-y-2">
                  <Label>Shareable Bug Report Link</Label>
                  <div className="flex gap-2">
                    <Input value={shareUrl} readOnly className="font-mono text-sm" />
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        toast.success('Link copied!');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={resetAll} className="flex-1">
                  Report Another
                </Button>
                <Button onClick={() => setOpen(false)} className="flex-1 bg-gray-900 hover:bg-gray-800 text-white">
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default VoiceBugReportButton;
