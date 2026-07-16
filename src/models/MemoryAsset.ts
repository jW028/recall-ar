export type MemoryAssetType = 'Person' | 'Object';
export type MemoryAssetStatus = 'Onboarding' | 'Maintenance' | 'Paused';

interface MemoryAssetBase {
    assetId: string;
    patientId: string;
    name: string;
    status: MemoryAssetStatus;
    pausedFrom: 'Onboarding' | 'Maintenance' | null; // status to restore on resume; null unless Paused
    imageUrl: string; // the chosen thumbnail; always one of photoUrls
    photoUrls: string[]; // pool of reference photos (public URLs); imageUrl ∈ photoUrls
    embedding: number[]; // averaged over photoUrls; length must match the type's model (see FACE/OBJECT_EMBEDDING_DIM)
    embeddingModel: string | null; // model that produced `embedding`; stale values are re-embedded, never compared
    notes: string;
    currentIntervalMinutes: number;
    nextReview: string; // ISO-8601 timestamp
    reviewCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface EnrolledPerson extends MemoryAssetBase {
    type: 'Person';
    dateOfBirth: string | null;
    relationship: string | null;
}

export interface EnrolledObject extends MemoryAssetBase {
    type: 'Object';
    category: string | null;
    reminderText: string | null;
}

export type MemoryAsset = EnrolledPerson | EnrolledObject;

// Type guards — narrow a MemoryAsset to its concrete variant
export function isPerson(asset: MemoryAsset): asset is EnrolledPerson {
    return asset.type === 'Person';
}

export function isObject(asset: MemoryAsset): asset is EnrolledObject {
    return asset.type === 'Object';
}