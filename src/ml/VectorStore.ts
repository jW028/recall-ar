import {
    AMBIGUITY_MARGIN,
    FACE_CONFIDENCE_THRESHOLD,
    FACE_EMBEDDING_DIM,
    OBJECT_CONFIDENCE_THRESHOLD,
    OBJECT_EMBEDDING_DIM,
} from '@/constants/config';
import type { MemoryAsset, MemoryAssetType } from '@/models/MemoryAsset';
import { MemoryAssetService } from '@/services/MemoryAssetService';

// Types
interface IndexedAsset {
    assetId: string;
    normalizedEmbedding: Float32Array;
}

export interface MatchResult {
    asset: MemoryAsset;
    similarity: number;
}

export interface QueryResult {
    match: MatchResult | null;
    ambiguousWith: MemoryAsset | null; // runner-up asset when it's a real, near-tied candidate
    bestScore: number;
    bestAssetId: string | null;
}

// People and objects are embedded by different models, so their vectors live in different spaces and must never
// be compared to each other. Each type gets its own index, dimension and confidence threshold.
export const TYPE_CONFIG: Record<MemoryAssetType, { dim: number; threshold: number }> = {
    Person: { dim: FACE_EMBEDDING_DIM, threshold: FACE_CONFIDENCE_THRESHOLD },
    Object: { dim: OBJECT_EMBEDDING_DIM, threshold: OBJECT_CONFIDENCE_THRESHOLD },
};

// Module-level indices, one per asset type
let indexedPatientId: string | null = null;
const indices: Record<MemoryAssetType, IndexedAsset[]> = { Person: [], Object: [] };
let assetsById: Map<string, MemoryAsset> = new Map();

// Math helpers
function l2Normalize(vector: number[] | Float32Array): Float32Array {
    let sumSquares = 0;
    for (let i = 0; i < vector.length; i++) {
      sumSquares += vector[i] * vector[i];
    }
    const magnitude = Math.sqrt(sumSquares) || 1; // avoid divide-by-zero

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / magnitude;
    }
    return normalized;

}

function dotProduct(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
}

// Build in-memory indices for enrolled memory assets
async function buildIndex(patientId: string, force = false): Promise<void> {
    if (!force && indexedPatientId === patientId) return;

    const assets = await MemoryAssetService.getAssetsForRecognition(patientId);

    const newIndices: Record<MemoryAssetType, IndexedAsset[]> = { Person: [], Object: [] };
    const newAssetsById = new Map<string, MemoryAsset>();

    for (const asset of assets) {
      const { dim } = TYPE_CONFIG[asset.type];
      if (asset.embedding.length !== dim) {
        // Skips malformed entries and embeddings produced by a previous model (e.g. objects still on the face model)
        console.warn(
          `[VectorStore] Skipping ${asset.type} ${asset.assetId}: embedding dim ${asset.embedding.length}, expected ${dim}`
        );
        continue;
      }

      newIndices[asset.type].push({
        assetId: asset.assetId,
        normalizedEmbedding: l2Normalize(asset.embedding),
      });
      newAssetsById.set(asset.assetId, asset);
    }

    indices.Person = newIndices.Person;
    indices.Object = newIndices.Object;
    assetsById = newAssetsById;
    indexedPatientId = patientId;
}

// Clear indices, called on logout/unpair
function clearIndex(): void {
    indices.Person = [];
    indices.Object = [];
    assetsById = new Map();
    indexedPatientId = null;
}

function getIndexSize(type?: MemoryAssetType): number {
    if (type) return indices[type].length;
    return indices.Person.length + indices.Object.length;
}

// Query the index for one asset type. The embedding must come from that type's model.
function query(liveEmbedding: number[], type: MemoryAssetType): QueryResult {
    const empty: QueryResult = { match: null, ambiguousWith: null, bestScore: -1, bestAssetId: null };
    const index = indices[type];
    const { dim, threshold } = TYPE_CONFIG[type];

    if (index.length === 0) return empty;

    if (liveEmbedding.length !== dim) {
      console.warn(
        `[VectorStore] ${type} query embedding has wrong dimension: expected ${dim}, got ${liveEmbedding.length}`
      );
      return empty;
    }

    const normalizedQuery = l2Normalize(liveEmbedding);

    // Track the top two candidates to detect near-ties between look-alikes
    let bestScore = -1;
    let bestAssetId: string | null = null;
    let secondScore = -1;
    let secondAssetId: string | null = null;

    for (const entry of index) {
      const score = dotProduct(normalizedQuery, entry.normalizedEmbedding);
      if (score > bestScore) {
        secondScore = bestScore;
        secondAssetId = bestAssetId;
        bestScore = score;
        bestAssetId = entry.assetId;
      } else if (score > secondScore) {
        secondScore = score;
        secondAssetId = entry.assetId;
      }
    }

    // UC07 Alternate Flow A1: Confidence not met
    if (bestScore < threshold || !bestAssetId) {
      return { match: null, ambiguousWith: null, bestScore, bestAssetId };
    }

    const asset = assetsById.get(bestAssetId);
    if (!asset) return { match: null, ambiguousWith: null, bestScore, bestAssetId };

    // Runner-up is a real, near-tied candidate — surface it so the caller can degrade gracefully
    const ambiguousWith =
      secondAssetId && secondScore >= threshold && bestScore - secondScore < AMBIGUITY_MARGIN
        ? assetsById.get(secondAssetId) ?? null
        : null;

    return { match: { asset, similarity: bestScore }, ambiguousWith, bestScore, bestAssetId };
}

// Export
export const VectorStore = {
    buildIndex,
    clearIndex,
    getIndexSize,
    query,
};
