import { AR_LIVE_CROP_FRACTION } from '@/constants/config';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import UPNG from 'upng-js';
import { FACE_MODEL_INPUT_SIZE } from './FaceEmbeddingModel';
import { OBJECT_MODEL_INPUT_SIZE } from './ObjectEmbeddingModel';

// Intermediate square the frame is normalised to before cropping, so the crop box can be computed
// without first decoding the image to read its dimensions.
const CROP_WORK_SIZE = 256;

export interface TensorSpec {
    size: number;
    // 'signed' = [-1,1] (MobileFaceNet), 'unit' = [0,1] (MobileNetV2 / TF-Hub convention)
    range: 'signed' | 'unit';
    // Centre-crop this fraction of the frame before resizing. Omit to use the whole frame.
    cropFraction?: number;
}

// People: whole frame, 160px, [-1,1].
export const FACE_TENSOR: TensorSpec = { size: FACE_MODEL_INPUT_SIZE, range: 'signed' };
// Objects at enrollment: photos are already square close-ups, so no crop — cropping them measurably hurt separation.
export const OBJECT_ENROLL_TENSOR: TensorSpec = { size: OBJECT_MODEL_INPUT_SIZE, range: 'unit' };
// Objects live: wide camera frames get centre-cropped to match the close-up enrollment framing.
export const OBJECT_LIVE_TENSOR: TensorSpec = {
    size: OBJECT_MODEL_INPUT_SIZE,
    range: 'unit',
    cropFraction: AR_LIVE_CROP_FRACTION,
};

// Squash to a known square first so the crop box is a pure function of CROP_WORK_SIZE. Cropping the centre of a
// uniformly-squashed image is equivalent to squashing a centre crop of the original, so this needs no image metadata.
function buildActions({ size, cropFraction }: TensorSpec): Action[] {
    if (!cropFraction || cropFraction >= 1) {
        return [{ resize: { width: size, height: size } }];
    }
    const cropSize = Math.round(CROP_WORK_SIZE * cropFraction);
    const origin = Math.round((CROP_WORK_SIZE - cropSize) / 2);
    return [
        { resize: { width: CROP_WORK_SIZE, height: CROP_WORK_SIZE } },
        { crop: { originX: origin, originY: origin, width: cropSize, height: cropSize } },
        { resize: { width: size, height: size } },
    ];
}

const REMOTE_URI = /^https?:/i;
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

// expo-image-manipulator reads local files only — handing it an https URL fails with "File ... is not readable".
// Enrollment pools are stored remotely, so a remote photo is pulled into the cache first and removed afterwards.
async function withLocalCopy<T>(uri: string, use: (localUri: string) => Promise<T>): Promise<T> {
    if (!REMOTE_URI.test(uri)) return use(uri);

    // Name the destination explicitly: header-derived names are unreliable for URLs with query strings or no extension.
    const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    const safeExt = IMAGE_EXTENSIONS.includes(ext) ? ext : 'jpg';
    const destination = new File(new Directory(Paths.cache), `embed-${Crypto.randomUUID()}.${safeExt}`);

    const downloaded = await File.downloadFileAsync(uri, destination, { idempotent: true });
    try {
        return await use(downloaded.uri);
    } finally {
        try {
            downloaded.delete();
        } catch {
            // Cache file; the OS reclaims it if the delete fails
        }
    }
}

export async function prepareImageTensor(uri: string, spec: TensorSpec): Promise<Float32Array> {
    const result = await withLocalCopy(uri, (localUri) =>
        manipulateAsync(localUri, buildActions(spec), {
            format: SaveFormat.PNG,
            base64: true,
        })
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

    // Normalize to Float32Array in HWC order, in the range the target model expects
    const { size, range } = spec;
    const tensor = new Float32Array(size * size * 3);
    for (let i = 0; i < size * size; i++) {
        for (let c = 0; c < 3; c++) {
            const v = rgba[i * 4 + c];
            tensor[i * 3 + c] = range === 'unit' ? v / 255 : v / 127.5 - 1.0;
        }
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
