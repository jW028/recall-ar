import {
    MAX_ENROLLMENT_PHOTOS,
    MIN_ENROLLMENT_PHOTOS,
} from '@/constants/config';
import type { MemoryAsset } from '@/models/MemoryAsset';
import {
    MemoryAssetService,
    type CreateObjectParams,
    type CreatePersonParams,
    type UpdateMemoryAssetParams,
} from '@/services/MemoryAssetService';
import { useCallback, useEffect, useMemo, useState } from 'react';

// List
type TypeFilter = 'all' | 'Person' | 'Object';

interface UseMemoryAssetListViewModel {
    assets: MemoryAsset[];
    filteredAssets: MemoryAsset[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    typeFilter: TypeFilter;
    setTypeFilter: (filter: TypeFilter) => void;
}

export function useMemoryAssetListViewModel(
    patientId: string | undefined
): UseMemoryAssetListViewModel {
    const [assets, setAssets] = useState<MemoryAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

    const refresh = useCallback(async () => {
        if (!patientId) return;
        setIsLoading(true);
        setError(null);
        const result = await MemoryAssetService.getAssetsByPatient(patientId);
        if (result.error) {
            setError(result.error);
        } else {
            setAssets(result.data ?? []);
        }
        setIsLoading(false);
    }, [patientId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const filteredAssets = useMemo(() => {
        if (typeFilter === 'all') return assets;
        return assets.filter((a) => a.type === typeFilter);
    }, [assets, typeFilter]);

    return { assets, filteredAssets, isLoading, error, refresh, typeFilter, setTypeFilter };
}

// Detail
interface UseMemoryAssetDetailViewModel {
    asset: MemoryAsset | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;

    updateAsset: (params: UpdateMemoryAssetParams) => Promise<boolean>;
    isUpdating: boolean;
    updateError: string | null;
    clearUpdateError: () => void;

    deleteAsset: () => Promise<boolean>;
    isDeleting: boolean;
    deleteError: string | null;
}

export function useMemoryAssetDetailViewModel(
    assetId: string | undefined
): UseMemoryAssetDetailViewModel {
    const [asset, setAsset] = useState<MemoryAsset | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!assetId) return;
        setIsLoading(true);
        setError(null);
        const result = await MemoryAssetService.getAssetById(assetId);
        if (result.error) {
            setError(result.error);
        } else {
            setAsset(result.data);
        }
        setIsLoading(false);
    }, [assetId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const updateAsset = useCallback(
        async (params: UpdateMemoryAssetParams): Promise<boolean> => {
            if (!assetId) return false;
            setIsUpdating(true);
            setUpdateError(null);
            const result = await MemoryAssetService.updateAsset(assetId, params);
            if (result.error || !result.data) {
                setUpdateError(result.error ?? 'Failed to update memory.');
                setIsUpdating(false);
                return false;
            }
            setAsset(result.data);
            setIsUpdating(false);
            return true;
        },
        [assetId]
    );

    const deleteAsset = useCallback(async (): Promise<boolean> => {
        if (!assetId) return false;
        setIsDeleting(true);
        setDeleteError(null);
        const result = await MemoryAssetService.deleteAsset(assetId);
        if (result.error) {
            setDeleteError(result.error);
            setIsDeleting(false);
            return false;
        }
        setIsDeleting(false);
        return true;
    }, [assetId]);

    const clearUpdateError = useCallback(() => setUpdateError(null), []);

    return {
        asset,
        isLoading,
        error,
        refresh,
        updateAsset,
        isUpdating,
        updateError,
        clearUpdateError,
        deleteAsset,
        isDeleting,
        deleteError,
    };
}

// Enrollment
type EnrollmentStep = 'idle' | 'capturing' | 'processing' | 'saving' | 'done';

interface UseEnrollmentViewModel {
    step: EnrollmentStep;
    photoUris: string[];
    addPhoto: (uri: string) => void;
    removePhoto: (uri: string) => void;
    canSubmit: boolean;
    submitPerson: (
        params: Omit<CreatePersonParams, 'photoUris' | 'embedding' | 'patientId'>
    ) => Promise<boolean>;
    submitObject: (
        params: Omit<CreateObjectParams, 'photoUris' | 'embedding' | 'patientId'>
    ) => Promise<boolean>;
    error: string | null;
}

export function useEnrollmentViewModel(
    patientId: string | undefined
): UseEnrollmentViewModel {
    const [step, setStep] = useState<EnrollmentStep>('idle');
    const [photoUris, setPhotoUris] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const canSubmit =
        photoUris.length >= MIN_ENROLLMENT_PHOTOS &&
        photoUris.length <= MAX_ENROLLMENT_PHOTOS;

    const addPhoto = useCallback((uri: string) => {
        setPhotoUris((prev) => {
            if (prev.length >= MAX_ENROLLMENT_PHOTOS) return prev;
            return [...prev, uri];
        });
    }, []);

    const removePhoto = useCallback((uri: string) => {
        setPhotoUris((prev) => prev.filter((u) => u !== uri));
    }, []);

    async function generateEmbedding(uris: string[]): Promise<number[] | null> {
        setStep('processing');
        try {
            const { FaceEmbeddingModel } =
                require('@/ml/FaceEmbeddingModel') as typeof import('@/ml/FaceEmbeddingModel');
            const { prepareImageTensor, averageEmbeddings } =
                require('@/ml/ImagePreprocessor') as typeof import('@/ml/ImagePreprocessor');

            await FaceEmbeddingModel.loadModel();
            const embeddings: number[][] = [];
            for (const uri of uris) {
                const tensor = await prepareImageTensor(uri);
                const emb = FaceEmbeddingModel.runInference(tensor);
                embeddings.push(emb);
            }
            return averageEmbeddings(embeddings);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to process photos.');
            setStep('idle');
            return null;
        }
    }

    const submitPerson = useCallback(
        async (
            params: Omit<CreatePersonParams, 'photoUris' | 'embedding' | 'patientId'>
        ): Promise<boolean> => {
            if (!patientId || !canSubmit) return false;
            setError(null);

            const embedding = await generateEmbedding(photoUris);
            if (!embedding) return false;

            setStep('saving');
            const result = await MemoryAssetService.createPerson({
                patientId,
                photoUris,
                embedding,
                ...params,
            });

            if (result.error || !result.data) {
                setError(result.error ?? 'Failed to save.');
                setStep('idle');
                return false;
            }

            setStep('done');
            return true;
        },
        [patientId, canSubmit, photoUris]
    );

    const submitObject = useCallback(
        async (
            params: Omit<CreateObjectParams, 'photoUris' | 'embedding' | 'patientId'>
        ): Promise<boolean> => {
            if (!patientId || !canSubmit) return false;
            setError(null);

            const embedding = await generateEmbedding(photoUris);
            if (!embedding) return false;

            setStep('saving');
            const result = await MemoryAssetService.createObject({
                patientId,
                photoUris,
                embedding,
                ...params,
            });

            if (result.error || !result.data) {
                setError(result.error ?? 'Failed to save.');
                setStep('idle');
                return false;
            }

            setStep('done');
            return true;
        },
        [patientId, canSubmit, photoUris]
    );

    return { step, photoUris, addPhoto, removePhoto, canSubmit, submitPerson, submitObject, error };
}
