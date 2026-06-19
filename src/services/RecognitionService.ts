import { AR_LATENCY_BUDGET_MS, CONFIDENCE_THRESHOLD } from '@/constants/config';
import { FACE_MODEL_INPUT_SIZE, FaceEmbeddingModel } from '@/ml/FaceEmbeddingModel';
import { VectorStore, type MatchResult } from '@/ml/VectorStore';
import { isPerson } from '@/models/MemoryAsset';

// Types
export type RecognitionStatus = 'scanning' | 'recognized' | 'unknown';
 
export interface RecognitionResult {
    status: RecognitionStatus;
    // Present only when status === 'recognized'
    assetId?: string;
    assetType?: 'Person' | 'Object';
    label?: string; 
    similarity?: number;
    // Frame processing time, for monitoring against AR_LATENCY_BUDGET_MS
    processingTimeMs: number;
}

// Helpers
function buildLabel(match: MatchResult): string {
    const { asset } = match;
   
    if (isPerson(asset)) {
      return asset.relationship
        ? `${asset.name}, ${asset.relationship}`
        : asset.name;
    }

    return asset.notes || asset.name;
}

// Recognition lifecycle
async function initialize(patientId: string): Promise<void> {
    await Promise.all([
      FaceEmbeddingModel.loadModel(),
      VectorStore.buildIndex(patientId),
    ]); 
}

// Tear down recognition pipeline, called when leaving AR screen or on session end
function teardown(): void {
    FaceEmbeddingModel.unloadModel();
    VectorStore.clearIndex();
}

// Call after memory asset create/update/delete to ensure fresh data gets queried
async function refreshIndex(patientId: string): Promise<void> {
    await VectorStore.buildIndex(patientId, true);
}

// Recognition loop
function processFrame(preparedInputTensor: Float32Array): RecognitionResult {
    const startTime = performance.now();
   
    if (!FaceEmbeddingModel.isModelReady()) {
      return {
        status: 'scanning',
        processingTimeMs: performance.now() - startTime,
      };
    }
   
    const embedding = FaceEmbeddingModel.runInference(preparedInputTensor);
    const { match, bestScore, bestAssetId } = VectorStore.query(embedding);

    const processingTimeMs = performance.now() - startTime;

    if (processingTimeMs > AR_LATENCY_BUDGET_MS) {
      // Non-fatal
      console.warn(
        `[RecognitionService] Frame exceeded latency budget: ${processingTimeMs.toFixed(1)}ms (budget ${AR_LATENCY_BUDGET_MS}ms)`
      );
    }

    if (!match) {
      console.log(
        `[RecognitionService] No match — best: ${bestScore.toFixed(3)} (${bestAssetId ?? 'none'}) threshold: ${CONFIDENCE_THRESHOLD}`
      );
      return { status: 'scanning', processingTimeMs };
    }

    console.log(
      `[RecognitionService] Recognized: "${buildLabel(match)}" (${match.asset.assetId}) similarity: ${match.similarity.toFixed(3)} threshold: ${CONFIDENCE_THRESHOLD} | ${processingTimeMs.toFixed(1)}ms`
    );

    return {
      status: 'recognized',
      assetId: match.asset.assetId,
      assetType: match.asset.type,
      label: buildLabel(match),
      similarity: match.similarity,
      processingTimeMs,
    };
}

// Export
export const RecognitionService = {
    initialize,
    teardown,
    refreshIndex,
    processFrame,
    FACE_MODEL_INPUT_SIZE,
};
  