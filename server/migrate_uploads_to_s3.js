// One-shot: re-upload pre-S3 local images to assets.influxcode.io and rewrite
// privbook_post_images.url / storage_key to point at S3.
//
// Usage:
//   node server/migrate_uploads_to_s3.js           # migrate
//   node server/migrate_uploads_to_s3.js --dry     # report only
//   node server/migrate_uploads_to_s3.js --delete  # also unlink local file after upload
//
// Safe to re-run: rows whose storage_key already starts with the S3 prefix are skipped.

import path from 'node:path';
import fs from 'node:fs/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import config from './config.js';
import pool from './db.js';

const dryRun = process.argv.includes('--dry');
const deleteLocal = process.argv.includes('--delete');
const uploadsDir = path.resolve(config.rootDir, 'uploads');

const s3 = new S3Client({
    region: config.s3.region,
    credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey },
});

function s3UrlFor(key) {
    return `https://s3.${config.s3.region}.amazonaws.com/${config.s3.bucket}/${key}`;
}

async function main() {
    const { rows } = await pool.query(
        `select id, storage_key, url
         from privbook_post_images
         where storage_key not like $1
         order by created_at asc`,
        [`${config.s3.prefix}/%`]
    );

    if (rows.length === 0) {
        console.log('Nothing to migrate. All images already on S3.');
        return;
    }

    console.log(`Found ${rows.length} image(s) to migrate (dry=${dryRun}, delete=${deleteLocal}).`);

    let migrated = 0;
    let missing = 0;
    let failed = 0;

    for (const row of rows) {
        const oldKey = row.storage_key;
        const newKey = `${config.s3.prefix}/${oldKey}`;
        const localPath = path.join(uploadsDir, oldKey);

        let buf;
        try {
            buf = await fs.readFile(localPath);
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.warn(`  miss ${row.id}  (no local file at ${localPath})`);
                missing++;
                continue;
            }
            throw err;
        }

        if (dryRun) {
            console.log(`  plan ${row.id}  ${oldKey}  ->  s3://${config.s3.bucket}/${newKey}  (${buf.length}b)`);
            migrated++;
            continue;
        }

        try {
            await s3.send(
                new PutObjectCommand({
                    Bucket: config.s3.bucket,
                    Key: newKey,
                    Body: buf,
                    ContentType: 'image/webp',
                    CacheControl: 'public, max-age=31536000, immutable',
                })
            );
            await pool.query(
                'update privbook_post_images set storage_key = $1, url = $2 where id = $3',
                [newKey, s3UrlFor(newKey), row.id]
            );
            if (deleteLocal) await fs.unlink(localPath).catch(() => {});
            console.log(`  ok   ${row.id}  ${oldKey}  ->  ${newKey}`);
            migrated++;
        } catch (err) {
            console.error(`  fail ${row.id}  ${oldKey}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\nDone. migrated=${migrated} missing=${missing} failed=${failed}`);
}

try {
    await main();
} finally {
    await pool.end();
}
