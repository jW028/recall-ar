import { EMBEDDING_DIM } from '@/constants/config';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';


// facenet_512.tflite expects a 160x160x3 float32 input tensor.
export const FACE_MODEL_INPUT_SIZE = 160;

let model: TensorflowModel | null = null;
let loadPromise: Promise<TensorflowModel> | null = null;

async function loadModel(): Promise<TensorflowModel> {
    if (model) return model;
    
    if (!loadPromise) {
        loadPromise = loadTensorflowModel(
            require('../../assets/models/facenet_512.tflite'),
            []
        ).then((loaded) => {
            model = loaded;
            return loaded;
        });
    }
    return loadPromise;
}

function isModelReady(): boolean {
    return model !== null;
}

// Run inference on a single prepared input tensor and returns raw embedding
function runInference(inputTensor: Float32Array): number[] {
    if (!model) {
        throw new Error(
            '[FaceEmbeddingModel] Model not loaded. Call loadModel() before runInference()'
        );
    }

    const expectedLength = model.inputs[0].shape.reduce((a, b) => a * b, 1);
    if (inputTensor.length !== expectedLength) {
        throw new Error(
            `[FaceEmbeddingModel] Input size mismatch: model expects ${expectedLength} floats ` +
                `(shape ${model.inputs[0].shape.join('x')}), got ${inputTensor.length}`
        );
    }

    const outputs = model.runSync([inputTensor.buffer as ArrayBuffer]);
    const embedding = new Float32Array(outputs[0]);

    if (embedding.length !== EMBEDDING_DIM) {
        throw new Error(
            `[FaceEmbeddingModel] Unexpected output dimension: expected ${EMBEDDING_DIM}, got ${embedding.length}`
        );
    }

    return Array.from(embedding);
}

// Release model fro mmemory, called when leaving AR screen for an extended period
function unloadModel(): void {
    model = null;
    loadPromise = null;
}

export const FaceEmbeddingModel = {
    loadModel,
    isModelReady,
    runInference,
    unloadModel,
};
