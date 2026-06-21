export type MemoryAssetType = 'Person' | 'Object';
export type MemoryAssetStatus = 'Onboarding' | 'Maintenance';

interface MemoryAssetBase {
    assetId: string;
    patientId: string;
    name: string;
    status: MemoryAssetStatus;
    imageUrl: string;
    embedding: number[]; // length must equal EMBEDDING_DIM 
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