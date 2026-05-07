import multer from 'multer';
import sharp from 'sharp';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import config from './config.js';

await fs.mkdir(config.uploadsDir, { recursive: true });

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

/**
 * Process an uploaded image: rotate via EXIF, resize to a sane max,
 * convert to webp, write to disk, return { storageKey, url, width, height }.
 */
export async function processImage(buffer, userId) {
    const id = crypto.randomBytes(12).toString('hex');
    const dir = path.join(config.uploadsDir, userId);
    await fs.mkdir(dir, { recursive: true });

    const filename = `${id}.webp`;
    const storageKey = path.join(userId, filename);
    const fullPath = path.join(dir, filename);

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
    await fs.writeFile(fullPath, data);

    const url = config.publicBaseUrl
        ? `${config.publicBaseUrl}/uploads/${storageKey}`
        : `/uploads/${storageKey}`;

    return { storageKey, url, width: info.width, height: info.height };
}

export async function deleteStoredImage(storageKey) {
    if (!storageKey) return;
    const full = path.join(config.uploadsDir, storageKey);
    try {
        await fs.unlink(full);
    } catch (err) {
        if (err.code !== 'ENOENT') console.warn('[upload] delete failed:', err.message);
    }
}
