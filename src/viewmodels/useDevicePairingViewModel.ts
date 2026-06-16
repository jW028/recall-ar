import { PairingService, type PairingToken } from '@/services/PairingService';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDevicePairingViewModel {
  pairingToken: PairingToken | null;
  isGenerating: boolean;
  error: string | null;
  secondsRemaining: number;
  isExpired: boolean;
  generateToken: () => Promise<void>;
}

export function useDevicePairingViewModel(
  patientId: string | undefined
): UseDevicePairingViewModel {
  const [pairingToken, setPairingToken] = useState<PairingToken | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateToken = useCallback(async () => {
    if (!patientId) return;

    setIsGenerating(true);
    setError(null);

    const result = await PairingService.generatePairingToken(patientId);

    if (result.error || !result.data) {
      setError(result.error ?? 'Failed to generate pairing code.');
      setIsGenerating(false);
      return;
    }

    setPairingToken(result.data);
    setIsGenerating(false);
  }, [patientId]);

  // Generate a token automatically when the screen mounts
  useEffect(() => {
    generateToken();
  }, [generateToken]);

  // Countdown timer ticks every second while a token is active
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!pairingToken) {
      setSecondsRemaining(0);
      return;
    }

    const tick = () => {
      const remainingMs =
        new Date(pairingToken.expiresAt).getTime() - Date.now();
      setSecondsRemaining(Math.max(0, Math.floor(remainingMs / 1000)));
    };

    tick(); // run immediately so UI doesn't show 0 for a frame
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pairingToken]);

  return {
    pairingToken,
    isGenerating,
    error,
    secondsRemaining,
    isExpired: pairingToken !== null && secondsRemaining === 0,
    generateToken,
  };
}