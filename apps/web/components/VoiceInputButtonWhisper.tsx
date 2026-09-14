"use client";

import { useState, useRef, useEffect } from "react";

interface VoiceInputButtonWhisperProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export function VoiceInputButtonWhisper({ onTranscript, className = "" }: VoiceInputButtonWhisperProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log('[WhisperButton] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        console.log('[WhisperButton] Recording stopped, processing...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setRecordingTime(0);
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
      
      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      console.log('[WhisperButton] Recording started');
    } catch (err) {
      console.error('[WhisperButton] Error starting recording:', err);
      const errorMsg = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow microphone access in your browser settings.'
        : 'Failed to start recording. Please check your microphone.';
      setError(errorMsg);
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      console.log('[WhisperButton] Sending audio to API, size:', audioBlob.size);
      
      const response = await fetch('/api/whisper', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error('[WhisperButton] API error response:', text);
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[WhisperButton] Non-JSON response:', text.substring(0, 200));
        throw new Error('API returned non-JSON response. Check console for details.');
      }
      
      const data = await response.json();
      
      if (data.success && data.text) {
        console.log('[WhisperButton] Transcription:', data.text);
        onTranscript(data.text);
      } else {
        throw new Error(data.error || 'Transcription failed');
      }
    } catch (err) {
      console.error('[WhisperButton] Transcription error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to transcribe audio';
      setError(errorMsg);
      setShowError(true);
      setTimeout(() => setShowError(false), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (!isProcessing) {
      startRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isProcessing}
        title={isRecording ? "Stop recording" : isProcessing ? "Processing..." : "Start recording"}
        className={`
          group relative rounded-full w-9 h-9 transition-all duration-300 ease-out
          flex items-center justify-center
          ${isRecording
            ? "bg-white text-red-500 shadow-lg shadow-red-500/20 ring-1 ring-red-500/40 scale-105"
            : isProcessing
            ? "bg-white text-blue-400 shadow-lg shadow-blue-500/15 cursor-wait"
            : "bg-white text-blue-500 hover:text-blue-600 hover:shadow-lg hover:shadow-blue-500/15 ring-1 ring-gray-200 hover:ring-blue-500/35 hover:scale-105"
          }
          ${className}
        `}
      >
        {isProcessing ? (
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg
            className={`h-5 w-5 transition-transform duration-200 ${isRecording ? 'scale-110' : 'group-hover:scale-110'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-xl bg-red-400/50 animate-ping" />
            <span className="absolute inset-0 rounded-xl bg-red-400/30 animate-pulse" />
          </>
        )}
      </button>

      {/* Recording timer */}
      {isRecording && (
        <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="rounded-lg bg-gradient-to-br from-red-600/70 to-red-700/70 backdrop-blur-md px-3 py-1.5 text-xs text-white shadow-lg border border-white/30">
            <div className="flex items-center gap-2 font-mono font-semibold">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              {formatTime(recordingTime)}
            </div>
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="rounded-lg bg-gradient-to-br from-blue-600/70 to-sky-500/70 backdrop-blur-md px-3.5 py-2 text-xs text-white shadow-lg border border-white/30">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="font-medium">Processing...</span>
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {showError && error && (
        <div className="fixed top-4 right-4 z-50 max-w-md rounded-lg bg-red-50 p-4 shadow-lg dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                Whisper Error
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
            </div>
            <button
              onClick={() => setShowError(false)}
              className="flex-shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
