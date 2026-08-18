import { isDatabaseReady } from '@/database/local/db';
import { AuthService } from '@/services/AuthService';
import { PairingService } from '@/services/PairingService';
import { SyncService } from '@/services/SyncService';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';

const SYNC_INTERVAL_MS = 30_000;

// Bounded wait for DatabaseProvider to finish initialising before the first sync — roughly 10s, after which the periodic timer takes over.
const STARTUP_DB_POLL_MS = 250;
const STARTUP_DB_ATTEMPTS = 40;

interface UseNetworkStatus {
  isOnline: boolean;
}

// Shared across every mount of this hook. Several screens call it independently, so without this each mount would run its own timer and overlapping cycles could push the same SyncLog row twice.
let inFlight: Promise<void> | null = null;

// Full bidirectional sync: flush local changes up, then pull remote changes down for whichever role this device is.
async function syncCycle(): Promise<void> {
  await SyncService.drainQueue();

  // A persisted pairing only ever exists on a patient device, and it is the authoritative patient id there.
  const pairing = await PairingService.getPersistedPairing();
  if (pairing) {
    await SyncService.pullAll(pairing.patientId);
    return;
  }

  // Otherwise this is a caregiver device. It has no pairing, which is why it used to pull nothing at all.
  const identity = await AuthService.getSessionIdentity();
  if (identity?.role === 'caregiver') {
    await SyncService.pullAllForCaregiver(identity.id);
  }
}

// Collapses concurrent callers onto one in-progress cycle rather than queueing a second.
function runSync(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = syncCycle().finally(() => {
    inFlight = null;
  });
  return inFlight;
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

  // Sync once at startup. This hook is mounted above DatabaseProvider, so the database is still initialising on the first render — without waiting for it, the first cycle would no-op and a freshly installed device would show nothing until the interval below first fires.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (let attempt = 0; attempt < STARTUP_DB_ATTEMPTS; attempt++) {
        if (isDatabaseReady()) break;
        await new Promise((resolve) => setTimeout(resolve, STARTUP_DB_POLL_MS));
      }
      if (cancelled || !isDatabaseReady()) return;

      runSync().catch((error) => {
        console.warn('[useNetworkStatus] Startup sync failed:', error);
      });
    })();

    return () => {
      cancelled = true;
    };
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
