import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const required = ['DB_PASSWORD', 'CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY', 'CLERK_JS_URL'];
for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

const config = {
    port: parseInt(process.env.PORT ?? '3030', 10),
    env: process.env.NODE_ENV ?? 'development',
    rootDir: path.resolve(__dirname, '..'),
    publicDir: path.resolve(__dirname, '..', 'public'),

    publicBaseUrl: process.env.PUBLIC_BASE_URL || '',

    db: {
        user: process.env.DB_USER ?? 'influx',
        host: process.env.DB_HOST ?? 'localhost',
        database: process.env.DB_NAME ?? 'influxcode',
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
    },

    clerk: {
        secretKey: process.env.CLERK_SECRET_KEY,
        publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
        jsUrl: process.env.CLERK_JS_URL,
        authorizedParties: (process.env.CLERK_AUTHORIZED_PARTIES ?? 'http://localhost:3030')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    },

    upload: {
        maxBytes: parseInt(process.env.MAX_UPLOAD_MB ?? '12', 10) * 1024 * 1024,
        maxImagesPerPost: parseInt(process.env.MAX_IMAGES_PER_POST ?? '10', 10),
        allowedMime: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']),
    },

    s3: {
        region: process.env.S3_REGION ?? 'us-east-1',
        bucket: process.env.S3_BUCKET ?? 'assets.influxcode.io',
        prefix: process.env.S3_PREFIX ?? 'privbook',
        accessKey: process.env.AWS_ACCESS_KEY,
        secretKey: process.env.AWS_SECRET_KEY,
    },
};

export default config;
