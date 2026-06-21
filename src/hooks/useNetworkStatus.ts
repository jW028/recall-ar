import { PairingService } from '@/services/PairingService';
import { SyncService } from '@/services/SyncService';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';

const SYNC_INTERVAL_MS = 30_000;

interface UseNetworkStatus {
  isOnline: boolean;
}

// Full bidirectional sync: flush local changes up, then pull remote changes down for the paired patient. Pull is a no-op when the device isn't paired.
async function runSync(): Promise<void> {
  await SyncService.drainQueue();
  const pairing = await PairingService.getPersistedPairing();
  if (pairing) {
    await SyncService.pullAll(pairing.patientId);
  }
}

export function useNetworkStatus(): UseNetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const isOnlineRef = useRef(true);

  // Tracks previous connectivity state so we only trigger a sync on the offline to online transition
  const wasOnlineRef = useRef(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOnline = Boolean(state.isConnected && state.isInternetReachable);

      setIsOnline(nowOnline);
      isOnlineRef.current = nowOnline;

      const justReconnected = nowOnline && !wasOnlineRef.current;
      if (justReconnected) {
        // Fire-and-forget: never let a sync failure (e.g. DB not yet ready, a flaky network) surface as an unhandled promise rejection.
        runSync().catch((error) => {
          console.warn('[useNetworkStatus] Sync on reconnect failed:', error);
        });
      }

      wasOnlineRef.current = nowOnline;
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (!isOnlineRef.current) return;
      runSync().catch((error) => {
        console.warn('[useNetworkStatus] Periodic sync failed:', error);
      });
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return { isOnline };
}
