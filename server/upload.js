import multer from 'multer';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import config from './config.js';

const s3 = new S3Client({
    region: config.s3.region,
    credentials:
        config.s3.accessKey && config.s3.secretKey
            ? { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey }
            : undefined,
});

export const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: config.upload.maxBytes,
        files: config.upload.maxImagesPerPost,
    },
    fileFilter: (_req, file, cb) => {
        if (config.upload.allowedMime.has(file.mimetype)) cb(null, true);
        else cb(new Error(`Unsupported image type: ${file.mimetype}`));
    },
});

// Bucket names containing dots break virtual-hosted-style HTTPS, so use path-style.
function publicUrlFor(key) {
    return `https://s3.${config.s3.region}.amazonaws.com/${config.s3.bucket}/${key}`;
}

/**
 * Process an uploaded image: rotate via EXIF, resize to a sane max,
 * convert to webp, upload to S3, return { storageKey, url, width, height }.
 */
export async function processImage(buffer, userId) {
    const id = crypto.randomBytes(12).toString('hex');
    const filename = `${id}.webp`;
    const storageKey = `${config.s3.prefix}/${userId}/${filename}`;

    const pipeline = sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize({
            width: 2048,
            height: 2048,
            fit: 'inside',
            withoutEnlargement: true,
        })
        .webp({ quality: 86 });

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    await s3.send(
        new PutObjectCommand({
            Bucket: config.s3.bucket,
            Key: storageKey,
            Body: data,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
        })
    );

    return { storageKey, url: publicUrlFor(storageKey), width: info.width, height: info.height };
}

export async function deleteStoredImage(storageKey) {
    if (!storageKey) return;
    try {
        await s3.send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: storageKey }));
    } catch (err) {
        console.warn('[upload] delete failed:', err.message);
    }
}
