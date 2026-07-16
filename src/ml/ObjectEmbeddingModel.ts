import { OBJECT_EMBEDDING_DIM } from '@/constants/config';
import { loadTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

// mobilenet_v2_feature.tflite expects a 128x128x3 float32 input tensor in the [0,1] range (TF-Hub convention).
export const OBJECT_MODEL_INPUT_SIZE = 128;

let model: TensorflowModel | null = null;
let loadPromise: Promise<TensorflowModel> | null = null;

async function loadModel(): Promise<TensorflowModel> {
    if (model) return model;

    if (!loadPromise) {
        loadPromise = loadTensorflowModel(
            require('../../assets/models/mobilenet_v2_feature.tflite'),
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

// Run inference on a single prepared input tensor and return the raw 1280-dim feature vector
function runInference(inputTensor: Float32Array): number[] {
    if (!model) {
        throw new Error(
            '[ObjectEmbeddingModel] Model not loaded. Call loadModel() before runInference()'
        );
    }

    const expectedLength = model.inputs[0].shape.reduce((a, b) => a * b, 1);
    if (inputTensor.length !== expectedLength) {
        throw new Error(
            `[ObjectEmbeddingModel] Input size mismatch: model expects ${expectedLength} floats ` +
                `(shape ${model.inputs[0].shape.join('x')}), got ${inputTensor.length}`
        );
    }

    const outputs = model.runSync([inputTensor.buffer as ArrayBuffer]);
    const embedding = new Float32Array(outputs[0]);

    if (embedding.length !== OBJECT_EMBEDDING_DIM) {
        throw new Error(
            `[ObjectEmbeddingModel] Unexpected output dimension: expected ${OBJECT_EMBEDDING_DIM}, got ${embedding.length}`
        );
    }

    return Array.from(embedding);
}

function unloadModel(): void {
    model = null;
    loadPromise = null;
}

export const ObjectEmbeddingModel = {
    loadModel,
    isModelReady,
    runInference,
    unloadModel,
};
