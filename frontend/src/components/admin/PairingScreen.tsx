import { useState, useEffect, useCallback } from 'react';
import type { Display } from '../../types';
import { listDisplays } from '../../api/display';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  slug: string;
  display: Display;
  onPaired: () => void;
  onClose: () => void;
}

export default function PairingScreen({ slug, display, onPaired, onClose }: Props) {
  const { token } = useAuth();
  const [paired, setPaired] = useState(false);

  const code = display.pairing_code || '000000';
  const codeLeft = code.slice(0, 3);
  const codeRight = code.slice(3, 6);

  // Auto-poll to check if pairing is complete
  const checkPairing = useCallback(async () => {
    if (!token || paired) return;
    try {
      const displays = await listDisplays(slug, token);
      const current = displays.find((d) => d.id === display.id);
      if (current && current.is_paired && !current.pairing_code) {
        setPaired(true);
        setTimeout(onPaired, 2500);
      }
    } catch {
      // Silently retry on next interval
    }
  }, [slug, token, display.id, paired, onPaired]);

  useEffect(() => {
    const interval = setInterval(checkPairing, 3000);
    return () => clearInterval(interval);
  }, [checkPairing]);

  if (paired) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-green-500/20">
            <svg className="h-14 w-14 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-4xl font-bold text-white mb-3">Display Paired!</h2>
          <p className="text-xl text-gray-400">
            <span className="font-medium text-white">{display.name}</span> is now connected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 text-gray-500 hover:text-gray-300 transition-colors"
        title="Close"
      >
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="text-center px-6">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-4 py-2 mb-8">
            <div className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            <span className="text-sm text-indigo-300 font-medium">Waiting for pairing…</span>
          </div>
        </div>

        <h2 className="text-2xl font-medium text-gray-400 mb-2">
          Pair your display at
        </h2>
        <p className="text-3xl font-bold text-white mb-12">
          hub.example.se/pair
        </p>

        <p className="text-lg text-gray-500 uppercase tracking-widest mb-4">
          Enter this code
        </p>

        <div className="flex items-center justify-center gap-6">
          <div className="flex gap-3">
            {codeLeft.split('').map((digit, i) => (
              <div
                key={`l-${i}`}
                className="flex h-24 w-20 items-center justify-center rounded-2xl bg-white/5 border border-white/10"
              >
                <span className="text-6xl font-bold text-white font-mono tracking-wider">{digit}</span>
              </div>
            ))}
          </div>

          <div className="h-2 w-2 rounded-full bg-gray-600" />

          <div className="flex gap-3">
            {codeRight.split('').map((digit, i) => (
              <div
                key={`r-${i}`}
                className="flex h-24 w-20 items-center justify-center rounded-2xl bg-white/5 border border-white/10"
              >
                <span className="text-6xl font-bold text-white font-mono tracking-wider">{digit}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 text-sm text-gray-600">
          Pairing <span className="text-gray-400">{display.name}</span>
        </p>
      </div>
    </div>
  );
}
