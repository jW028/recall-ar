import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import UPNG from 'upng-js';
import { FACE_MODEL_INPUT_SIZE } from './FaceEmbeddingModel';

export async function prepareImageTensor(uri: string): Promise<Float32Array> {
    const result = await manipulateAsync(
        uri,
        [{ resize: { width: FACE_MODEL_INPUT_SIZE, height: FACE_MODEL_INPUT_SIZE } }],
        { format: SaveFormat.PNG, base64: true }
    );

    if (!result.base64) {
        throw new Error('[ImagePreprocessor] Failed to get base64 from resized image');
    }

    // Decode base64 PNG → raw bytes
    const binary = atob(result.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    // Decode PNG → RGBA pixels
    const img = UPNG.decode(bytes.buffer as ArrayBuffer);
    const rgba = new Uint8Array(UPNG.toRGBA8(img)[0]);

    // Normalize to Float32Array in HWC order, MobileFaceNet range [-1, 1]
    const tensor = new Float32Array(FACE_MODEL_INPUT_SIZE * FACE_MODEL_INPUT_SIZE * 3);
    for (let i = 0; i < FACE_MODEL_INPUT_SIZE * FACE_MODEL_INPUT_SIZE; i++) {
        tensor[i * 3 + 0] = rgba[i * 4 + 0] / 127.5 - 1.0; // R
        tensor[i * 3 + 1] = rgba[i * 4 + 1] / 127.5 - 1.0; // G
        tensor[i * 3 + 2] = rgba[i * 4 + 2] / 127.5 - 1.0; // B
    }
    return tensor;
}

export function averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    const dim = embeddings[0].length;
    const avg = new Array<number>(dim).fill(0);
    for (const emb of embeddings) {
        for (let i = 0; i < dim; i++) {
            avg[i] += emb[i];
        }
    }
    for (let i = 0; i < dim; i++) {
        avg[i] /= embeddings.length;
    }
    return avg;
}
