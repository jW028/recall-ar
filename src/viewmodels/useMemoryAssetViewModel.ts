import {
    MAX_ENROLLMENT_PHOTOS,
    MIN_ENROLLMENT_PHOTOS,
} from '@/constants/config';
import type { MemoryAsset, MemoryAssetType } from '@/models/MemoryAsset';
import {
    MemoryAssetService,
    type CreateObjectParams,
    type CreatePersonParams,
    type UpdateMemoryAssetParams,
} from '@/services/MemoryAssetService';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Runs the on-device embedding model for the given asset type over the photos and returns the averaged embedding.
// People use the face model; objects use a general image-feature model — a face model cannot embed objects.
// Shared by enrollment and photo re-enrollment. Throws on failure so callers can surface a message.
async function computeEmbedding(type: MemoryAssetType, uris: string[]): Promise<number[]> {
    const { FaceEmbeddingModel } =
        require('@/ml/FaceEmbeddingModel') as typeof import('@/ml/FaceEmbeddingModel');
    const { ObjectEmbeddingModel } =
        require('@/ml/ObjectEmbeddingModel') as typeof import('@/ml/ObjectEmbeddingModel');
    const { prepareImageTensor, averageEmbeddings, FACE_TENSOR, OBJECT_ENROLL_TENSOR } =
        require('@/ml/ImagePreprocessor') as typeof import('@/ml/ImagePreprocessor');

    const isPersonType = type === 'Person';
    const model = isPersonType ? FaceEmbeddingModel : ObjectEmbeddingModel;
    const spec = isPersonType ? FACE_TENSOR : OBJECT_ENROLL_TENSOR;

    await model.loadModel();
    const embeddings: number[][] = [];
    for (const uri of uris) {
        const tensor = await prepareImageTensor(uri, spec);
        embeddings.push(model.runInference(tensor));
    }
    return averageEmbeddings(embeddings);
}

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
    // Active pool count (Onboarding + Maintenance); paused assets excluded, matching the cap rule.
    activeCount: number;
    pause: (assetId: string) => Promise<boolean>;
    resume: (assetId: string) => Promise<boolean>;
    pendingId: string | null; // asset currently pausing/resuming, for a per-row spinner
}

export function useMemoryAssetListViewModel(
    patientId: string | undefined
): UseMemoryAssetListViewModel {
    const [assets, setAssets] = useState<MemoryAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [pendingId, setPendingId] = useState<string | null>(null);

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

    const pause = useCallback(async (assetId: string): Promise<boolean> => {
        setPendingId(assetId);
        setError(null);
        const result = await MemoryAssetService.pauseAsset(assetId);
        setPendingId(null);
        if (result.error) {
            setError(result.error);
            return false;
        }
        await refresh();
        return true;
    }, [refresh]);

    const resume = useCallback(async (assetId: string): Promise<boolean> => {
        setPendingId(assetId);
        setError(null);
        const result = await MemoryAssetService.resumeAsset(assetId);
        setPendingId(null);
        if (result.error) {
            setError(result.error);
            return false;
        }
        await refresh();
        return true;
    }, [refresh]);

    const filteredAssets = useMemo(() => {
        if (typeFilter === 'all') return assets;
        return assets.filter((a) => a.type === typeFilter);
    }, [assets, typeFilter]);

    const activeCount = useMemo(
        () => assets.filter((a) => a.status === 'Onboarding' || a.status === 'Maintenance').length,
        [assets]
    );

    return {
        assets,
        filteredAssets,
        isLoading,
        error,
        refresh,
        typeFilter,
        setTypeFilter,
        activeCount,
        pause,
        resume,
        pendingId,
    };
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

    // Photo pool editing: keep some existing pool URLs, add new local photos, and re-average the embedding over the resulting pool. photoStep reflects the heavier two phases (model inference, then upload + save).
    updatePool: (params: { keepUrls: string[]; newPhotoUris: string[] }) => Promise<boolean>;
    photoStep: 'idle' | 'processing' | 'saving';

    // Thumbnail selection: repoints the display image at an existing pool photo. No upload or embedding change, so it works offline.
    setThumbnail: (thumbnailUrl: string) => Promise<boolean>;

    // Pause/resume training: freezes scheduling state and removes the asset from the daily queue until resumed.
    pause: () => Promise<boolean>;
    resume: () => Promise<boolean>;
    isPausing: boolean;
    pauseError: string | null;

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

    const [photoStep, setPhotoStep] = useState<'idle' | 'processing' | 'saving'>('idle');

    const [isPausing, setIsPausing] = useState(false);
    const [pauseError, setPauseError] = useState<string | null>(null);

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

    const updatePool = useCallback(
        async ({
            keepUrls,
            newPhotoUris,
        }: {
            keepUrls: string[];
            newPhotoUris: string[];
        }): Promise<boolean> => {
            if (!assetId) return false;
            setUpdateError(null);
            setPhotoStep('processing');
            try {
                // The embedding is averaged over the whole pool, so re-run the model over the kept (remote) photos plus the new local ones.
                if (!asset) {
                    setUpdateError('Memory not loaded.');
                    return false;
                }
                const embedding = await computeEmbedding(asset.type, [...keepUrls, ...newPhotoUris]);
                setPhotoStep('saving');
                const result = await MemoryAssetService.updateAssetPool(assetId, {
                    keepUrls,
                    newPhotoUris,
                    embedding,
                });
                if (result.error || !result.data) {
                    setUpdateError(result.error ?? 'Failed to update photos.');
                    return false;
                }
                setAsset(result.data);
                return true;
            } catch (e) {
                setUpdateError(e instanceof Error ? e.message : 'Failed to process photos.');
                return false;
            } finally {
                setPhotoStep('idle');
            }
        },
        [assetId, asset]
    );

    const setThumbnail = useCallback(
        async (thumbnailUrl: string): Promise<boolean> => {
            if (!assetId) return false;
            setUpdateError(null);
            const result = await MemoryAssetService.setThumbnail(assetId, thumbnailUrl);
            if (result.error || !result.data) {
                setUpdateError(result.error ?? 'Failed to update thumbnail.');
                return false;
            }
            setAsset(result.data);
            return true;
        },
        [assetId]
    );

    const pause = useCallback(async (): Promise<boolean> => {
        if (!assetId) return false;
        setIsPausing(true);
        setPauseError(null);
        const result = await MemoryAssetService.pauseAsset(assetId);
        if (result.error || !result.data) {
            setPauseError(result.error ?? 'Failed to pause training.');
            setIsPausing(false);
            return false;
        }
        setAsset(result.data);
        setIsPausing(false);
        return true;
    }, [assetId]);

    const resume = useCallback(async (): Promise<boolean> => {
        if (!assetId) return false;
        setIsPausing(true);
        setPauseError(null);
        const result = await MemoryAssetService.resumeAsset(assetId);
        if (result.error || !result.data) {
            setPauseError(result.error ?? 'Failed to resume training.');
            setIsPausing(false);
            return false;
        }
        setAsset(result.data);
        setIsPausing(false);
        return true;
    }, [assetId]);

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
        updatePool,
        photoStep,
        setThumbnail,
        pause,
        resume,
        isPausing,
        pauseError,
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
    // Lowercased categories of objects already enrolled for this patient, for duplicate-category warnings
    existingObjectCategories: string[];
}

export function useEnrollmentViewModel(
    patientId: string | undefined
): UseEnrollmentViewModel {
    const [step, setStep] = useState<EnrollmentStep>('idle');
    const [photoUris, setPhotoUris] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [existingObjectCategories, setExistingObjectCategories] = useState<string[]>([]);

    // Load existing object categories once so the form can warn about look-alike collisions
    useEffect(() => {
        if (!patientId) return;
        let cancelled = false;
        (async () => {
            const result = await MemoryAssetService.getAssetsByPatient(patientId, 'Object');
            if (cancelled || result.error || !result.data) return;
            const categories = result.data
                .map((a) => (a.type === 'Object' ? a.category?.trim().toLowerCase() : null))
                .filter((c): c is string => !!c);
            setExistingObjectCategories(Array.from(new Set(categories)));
        })();
        return () => {
            cancelled = true;
        };
    }, [patientId]);

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

    async function generateEmbedding(type: MemoryAssetType, uris: string[]): Promise<number[] | null> {
        setStep('processing');
        try {
            return await computeEmbedding(type, uris);
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

            const embedding = await generateEmbedding('Person', photoUris);
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

            const embedding = await generateEmbedding('Object', photoUris);
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

    return { step, photoUris, addPhoto, removePhoto, canSubmit, submitPerson, submitObject, error, existingObjectCategories };
}
