import { AR_LATENCY_BUDGET_MS } from '@/constants/config';
import { FACE_MODEL_INPUT_SIZE, FaceEmbeddingModel } from '@/ml/FaceEmbeddingModel';
import {
    averageEmbeddings,
    FACE_TENSOR,
    OBJECT_ENROLL_TENSOR,
    OBJECT_LIVE_TENSOR,
    prepareImageTensor,
} from '@/ml/ImagePreprocessor';
import { ObjectEmbeddingModel } from '@/ml/ObjectEmbeddingModel';
import { TYPE_CONFIG, VectorStore, type MatchResult, type QueryResult } from '@/ml/VectorStore';
import { isObject, isPerson, type MemoryAsset, type MemoryAssetType } from '@/models/MemoryAsset';
import { MemoryAssetService } from '@/services/MemoryAssetService';

// Types
export type RecognitionStatus = 'scanning' | 'recognized' | 'ambiguous' | 'unknown';

export interface RecognitionResult {
    status: RecognitionStatus;
    // Present when status === 'recognized' or 'ambiguous'
    assetId?: string;
    assetType?: MemoryAssetType;
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

// Returns the shared category (from the best match) when two near-tied objects belong to the same category
function sharedObjectCategory(a: MemoryAsset, b: MemoryAsset): string | null {
    if (!isObject(a) || !isObject(b)) return null;
    const categoryA = a.category?.trim();
    const categoryB = b.category?.trim();
    if (!categoryA || !categoryB) return null;
    return categoryA.toLowerCase() === categoryB.toLowerCase() ? categoryA : null;
}

// How far a score clears its own threshold, as a fraction of the headroom above it. Raw cosine scores from the
// face and object models are not comparable, so this is what lets one frame's two candidates be ranked against
// each other.
function normalizedConfidence(score: number, type: MemoryAssetType): number {
    const { threshold } = TYPE_CONFIG[type];
    return (score - threshold) / (1 - threshold);
}

// Assets enrolled under a previous model carry vectors that are not comparable to fresh ones (objects, for
// instance, were embedded with the face model before objects got their own). Re-embed them from their stored
// photos so they become recognizable again without asking the caregiver to re-enroll. Runs once per model change.
async function reembedStaleAssets(patientId: string): Promise<void> {
    const stale = await MemoryAssetService.getAssetsNeedingReembed(patientId);
    if (stale.length === 0) return;

    console.log(`[RecognitionService] Re-embedding ${stale.length} asset(s) after a model change`);
    for (const asset of stale) {
      try {
        const isPersonType = asset.type === 'Person';
        const model = isPersonType ? FaceEmbeddingModel : ObjectEmbeddingModel;
        const spec = isPersonType ? FACE_TENSOR : OBJECT_ENROLL_TENSOR;

        const embeddings: number[][] = [];
        for (const url of asset.photoUrls) {
          embeddings.push(model.runInference(await prepareImageTensor(url, spec)));
        }

        const { error } = await MemoryAssetService.setEmbedding(
          asset.assetId,
          asset.type,
          averageEmbeddings(embeddings)
        );
        if (error) {
          console.warn(`[RecognitionService] Re-embed failed for ${asset.assetId}: ${error}`);
        }
      } catch (e) {
        // A single unreadable photo pool must not stop the rest from being repaired
        console.warn(`[RecognitionService] Re-embed threw for ${asset.assetId}`, e);
      }
    }
}

// Recognition lifecycle
async function initialize(patientId: string): Promise<void> {
    await Promise.all([FaceEmbeddingModel.loadModel(), ObjectEmbeddingModel.loadModel()]);
    // Must precede the index build, which skips any vector whose dimension doesn't match its type's model
    await reembedStaleAssets(patientId);
    await VectorStore.buildIndex(patientId, true);
}

// Tear down recognition pipeline, called when leaving AR screen or on session end
function teardown(): void {
    FaceEmbeddingModel.unloadModel();
    ObjectEmbeddingModel.unloadModel();
    VectorStore.clearIndex();
}

// Call after memory asset create/update/delete to ensure fresh data gets queried
async function refreshIndex(patientId: string): Promise<void> {
    await VectorStore.buildIndex(patientId, true);
}

function modelsReady(): boolean {
    return FaceEmbeddingModel.isModelReady() && ObjectEmbeddingModel.isModelReady();
}

// Resolves one type's query into a result, applying the shared-category degrade for near-tied look-alikes.
function resolve(q: QueryResult, processingTimeMs: number): RecognitionResult | null {
    if (!q.match) return null;

    // Two enrolled items are too close to tell apart — never assert a specific wrong label
    if (q.ambiguousWith) {
      const category = sharedObjectCategory(q.match.asset, q.ambiguousWith);
      // Same-category objects degrade to the shared category (e.g. "Keys"); anything else stays neutral
      if (!category) {
        console.log(
          `[RecognitionService] Ambiguous with no shared category (${q.match.asset.assetId} ~ ${q.ambiguousWith.assetId}) — degrading to scanning`
        );
        return null;
      }
      console.log(
        `[RecognitionService] Ambiguous: "${category}" (${q.match.asset.assetId} ~ ${q.ambiguousWith.assetId}) similarity: ${q.match.similarity.toFixed(3)}`
      );
      return {
        status: 'ambiguous',
        assetId: q.match.asset.assetId,
        assetType: q.match.asset.type,
        label: category,
        similarity: q.match.similarity,
        processingTimeMs,
      };
    }

    return {
      status: 'recognized',
      assetId: q.match.asset.assetId,
      assetType: q.match.asset.type,
      label: buildLabel(q.match),
      similarity: q.match.similarity,
      processingTimeMs,
    };
}

// Recognition loop. Embeds the frame with both models and queries each type's index — a frame may contain either
// a face or an object, and only the per-type thresholds can tell which.
async function processFrame(frameUri: string): Promise<RecognitionResult> {
    const startTime = performance.now();

    if (!modelsReady()) {
      return { status: 'scanning', processingTimeMs: performance.now() - startTime };
    }

    const [faceTensor, objectTensor] = await Promise.all([
      prepareImageTensor(frameUri, FACE_TENSOR),
      prepareImageTensor(frameUri, OBJECT_LIVE_TENSOR),
    ]);

    const faceQuery = VectorStore.query(FaceEmbeddingModel.runInference(faceTensor), 'Person');
    const objectQuery = VectorStore.query(ObjectEmbeddingModel.runInference(objectTensor), 'Object');

    const processingTimeMs = performance.now() - startTime;

    if (processingTimeMs > AR_LATENCY_BUDGET_MS) {
      // Non-fatal
      console.warn(
        `[RecognitionService] Frame exceeded latency budget: ${processingTimeMs.toFixed(1)}ms (budget ${AR_LATENCY_BUDGET_MS}ms)`
      );
    }

    if (!faceQuery.match && !objectQuery.match) {
      console.log(
        `[RecognitionService] No match — face: ${faceQuery.bestScore.toFixed(3)}/${TYPE_CONFIG.Person.threshold} ` +
          `object: ${objectQuery.bestScore.toFixed(3)}/${TYPE_CONFIG.Object.threshold}`
      );
      return { status: 'scanning', processingTimeMs };
    }

    // When both models match, prefer whichever cleared its own threshold by more
    let winner: QueryResult;
    if (faceQuery.match && objectQuery.match) {
      winner =
        normalizedConfidence(faceQuery.bestScore, 'Person') >=
        normalizedConfidence(objectQuery.bestScore, 'Object')
          ? faceQuery
          : objectQuery;
    } else {
      winner = faceQuery.match ? faceQuery : objectQuery;
    }

    const result = resolve(winner, processingTimeMs);
    if (!result) return { status: 'scanning', processingTimeMs };

    if (result.status === 'recognized') {
      console.log(
        `[RecognitionService] Recognized: "${result.label}" (${result.assetId}) similarity: ${result.similarity?.toFixed(3)} | ${processingTimeMs.toFixed(1)}ms`
      );
    }
    return result;
}

// Export
export const RecognitionService = {
    initialize,
    teardown,
    refreshIndex,
    processFrame,
    FACE_MODEL_INPUT_SIZE,
};
