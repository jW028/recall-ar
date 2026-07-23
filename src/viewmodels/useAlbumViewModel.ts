import type { MemoryAsset } from '@/models/MemoryAsset';
import { MemoryAssetService } from '@/services/MemoryAssetService';
import { PairingService } from '@/services/PairingService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

type AlbumStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseAlbumViewModel {
    status: AlbumStatus;
    error: string | null;
    mastered: MemoryAsset[];
    learning: MemoryAsset[];
    refresh: () => Promise<void>;
}

// Patient album: all enrolled memories, split into mastered (Maintenance) and still-learning.
export function useAlbumViewModel(): UseAlbumViewModel {
    const [status, setStatus] = useState<AlbumStatus>('loading');
    const [error, setError] = useState<string | null>(null);
    const [mastered, setMastered] = useState<MemoryAsset[]>([]);
    const [learning, setLearning] = useState<MemoryAsset[]>([]);
    const mountedRef = useRef(true);

    const refresh = useCallback(async () => {
        const pairing = await PairingService.getPersistedPairing();
        if (!mountedRef.current) return;
        if (!pairing) {
            setError('This device is not paired to a patient.');
            setStatus('error');
            return;
        }

        const result = await MemoryAssetService.getAssetsByPatient(pairing.patientId);
        if (!mountedRef.current) return;
        if (result.error || !result.data) {
            setError(result.error ?? 'Failed to load your album.');
            setStatus('error');
            return;
        }

        setMastered(result.data.filter((a) => a.status === 'Maintenance'));
        setLearning(result.data.filter((a) => a.status !== 'Maintenance'));
        setError(null);
        setStatus(result.data.length === 0 ? 'empty' : 'ready');
    }, []);

    // Refresh on every focus so a mastery from a just-finished session shows immediately.
    useFocusEffect(
        useCallback(() => {
            mountedRef.current = true;
            refresh();
            return () => {
                mountedRef.current = false;
            };
        }, [refresh])
    );

    return { status, error, mastered, learning, refresh };
}
