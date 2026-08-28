import { useState, useRef, useCallback, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type VoiceState = 'idle' | 'listening' | 'processing';

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  onPartial?: (text: string) => void;
  className?: string;
}

// ── SpeechRecognition compat ─────────────────────────────────────────────────

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function VoiceButton({
  onTranscript,
  onPartial,
  className = '',
}: VoiceButtonProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const supported = !!getSpeechRecognition();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionClass = getSpeechRecognition();
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (interim && onPartial) {
        onPartial(interim);
      }
      if (final) {
        setState('processing');
        onTranscript(final.trim());
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', e.error);
      setState('idle');
    };

    recognition.onend = () => {
      setState((prev) => (prev === 'processing' ? prev : 'idle'));
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState('listening');
  }, [onTranscript, onPartial]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const handleClick = () => {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'idle') {
      startListening();
    }
  };

  // Reset processing state after a timeout (safety net)
  useEffect(() => {
    if (state === 'processing') {
      const timer = setTimeout(() => setState('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'processing'}
      aria-label={
        state === 'listening'
          ? 'Stop listening'
          : state === 'processing'
            ? 'Processing speech'
            : 'Start voice input'
      }
      className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${
        state === 'listening'
          ? 'bg-red-500 text-white'
          : state === 'processing'
            ? 'bg-gray-300 text-gray-500'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300'
      } ${className}`}
    >
      {/* Pulse ring animation when listening */}
      {state === 'listening' && (
        <>
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
          <span className="absolute inset-0 rounded-full bg-red-400 animate-pulse opacity-20" />
        </>
      )}
      <span className="relative text-lg" role="img" aria-hidden="true">
        🎤
      </span>
    </button>
  );
}
