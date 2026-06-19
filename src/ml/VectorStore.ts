import { CONFIDENCE_THRESHOLD, EMBEDDING_DIM } from '@/constants/config';
import type { MemoryAsset } from '@/models/MemoryAsset';
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
    bestScore: number;
    bestAssetId: string | null;
}

// Module-level index
let indexedPatientId: string | null = null;
let index: IndexedAsset[] = [];
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

// Build in-memory index for enrolled memory assets 
async function buildIndex(patientId: string, force = false): Promise<void> {
    if (!force && indexedPatientId === patientId) return;
   
    const assets = await MemoryAssetService.getAssetsForRecognition(patientId);
   
    const newIndex: IndexedAsset[] = [];
    const newAssetsById = new Map<string, MemoryAsset>();
   
    for (const asset of assets) {
      if (asset.embedding.length !== EMBEDDING_DIM) {
        // Skip malformed entries 
        console.warn(
          `[VectorStore] Skipping asset ${asset.assetId}: embedding dimension mismatch`
        );
        continue;
      }
   
      newIndex.push({
        assetId: asset.assetId,
        normalizedEmbedding: l2Normalize(asset.embedding),
      });
      newAssetsById.set(asset.assetId, asset);
    }
   
    index = newIndex;
    assetsById = newAssetsById;
    indexedPatientId = patientId;
}
  
// Clear index, called on logout/unpair 
function clearIndex(): void {
    index = [];
    assetsById = new Map();
    indexedPatientId = null;
}

function getIndexSize(): number{
    return index.length;
}

// Query embeddings to find match
function query(liveEmbedding: number[]): QueryResult {
    const empty: QueryResult = { match: null, bestScore: -1, bestAssetId: null };

    if (index.length === 0) return empty;

    if (liveEmbedding.length !== EMBEDDING_DIM) {
      console.warn(
        `[VectorStore] Query embedding has wrong dimension: expected ${EMBEDDING_DIM}, got ${liveEmbedding.length}`
      );
      return empty;
    }

    const normalizedQuery = l2Normalize(liveEmbedding);

    let bestScore = -1;
    let bestAssetId: string | null = null;

    for (const entry of index) {
      const score = dotProduct(normalizedQuery, entry.normalizedEmbedding);
      if (score > bestScore) {
        bestScore = score;
        bestAssetId = entry.assetId;
      }
    }

    // UC07 Alternate Flow A1: Confidence not met
    if (bestScore < CONFIDENCE_THRESHOLD || !bestAssetId) {
      return { match: null, bestScore, bestAssetId };
    }

    const asset = assetsById.get(bestAssetId);
    if (!asset) return { match: null, bestScore, bestAssetId };

    return { match: { asset, similarity: bestScore }, bestScore, bestAssetId };
}

// Export
export const VectorStore = {
    buildIndex,
    clearIndex,
    getIndexSize,
    query,
};