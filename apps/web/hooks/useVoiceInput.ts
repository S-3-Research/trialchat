import { useState, useRef, useCallback, useEffect } from 'react';

// Type definitions for Web Speech API.
// Named with a `TC` (TrialChat) prefix rather than the bare `SpeechRecognition*`
// names, since some TypeScript `lib.dom.d.ts` versions now ship their own
// (differently-modifiered) global `SpeechRecognition` declarations, and
// re-declaring the same global name with different modifiers is a hard
// compile error ("All declarations of 'X' must have identical modifiers").
// Prefixing sidesteps that entirely regardless of the lib/TS version in use.
interface TCSpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface TCSpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface TCSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onaudiostart: ((this: TCSpeechRecognition, ev: Event) => void) | null;
  onaudioend: ((this: TCSpeechRecognition, ev: Event) => void) | null;
  onend: ((this: TCSpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: TCSpeechRecognition, ev: TCSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((this: TCSpeechRecognition, ev: TCSpeechRecognitionEvent) => void) | null;
  onstart: ((this: TCSpeechRecognition, ev: Event) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => TCSpeechRecognition;
    webkitSpeechRecognition?: new () => TCSpeechRecognition;
  }
}

export interface UseVoiceInputOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onTranscriptChange?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const {
    lang = 'en-US',
    continuous = false,
    interimResults = true,
    onTranscriptChange,
    onError,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<TCSpeechRecognition | null>(null);

  // Check browser support on mount
  useEffect(() => {
    const supported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    setIsSupported(supported);
  }, []);

  const startListening = useCallback(() => {
    console.log('[useVoiceInput] startListening called, isSupported:', isSupported);
    
    if (!isSupported) {
      const errorMsg = 'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionCtor) {
        const errorMsg = 'Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge.';
        setError(errorMsg);
        onError?.(errorMsg);
        return;
      }
      const recognition = new SpeechRecognitionCtor();
      
      console.log('[useVoiceInput] SpeechRecognition created');

      recognition.lang = lang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('[useVoiceInput] Recognition started');
        setIsListening(true);
        setError(null);
        setTranscript('');
        setInterimTranscript('');
      };

      recognition.onresult = (event: TCSpeechRecognitionEvent) => {
        let finalText = '';
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;

          if (result.isFinal) {
            finalText += text;
          } else {
            interimText += text;
          }
        }

        if (finalText) {
          setTranscript((prev) => prev + finalText);
          onTranscriptChange?.(finalText, true);
        }

        if (interimText) {
          setInterimTranscript(interimText);
          onTranscriptChange?.(interimText, false);
        }
      };

      recognition.onerror = (event: TCSpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        
        let errorMsg = 'An error occurred during speech recognition.';
        
        switch (event.error) {
          case 'no-speech':
            errorMsg = 'No speech detected. Please try again.';
            break;
          case 'audio-capture':
            errorMsg = 'Microphone not available. Please check your device settings.';
            break;
          case 'not-allowed':
            errorMsg = 'Microphone access denied. Click the lock icon in your address bar (or Settings > Safari > This Website on mobile) to allow microphone access, then refresh the page.';
            break;
          case 'network':
            errorMsg = 'Network error occurred. Please check your connection.';
            break;
          case 'aborted':
            // User stopped, not an error
            return;
        }

        setError(errorMsg);
        onError?.(errorMsg);
        setIsListening(false);
      };

      recognition.onend = () => {
        console.log('[useVoiceInput] Recognition ended');
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      console.log('[useVoiceInput] Calling recognition.start()');
      recognition.start();
    } catch (err) {
      console.error('[useVoiceInput] Exception during start:', err);
      const errorMsg = 'Failed to start speech recognition. Please try again.';
      setError(errorMsg);
      onError?.(errorMsg);
      console.error('Recognition start error:', err);
    }
  }, [isSupported, lang, continuous, interimResults, onTranscriptChange, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
