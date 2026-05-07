import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs/promises';

import config from './config.js';
import { requireAuth, withUser } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import meRoutes from './routes/me.js';
import postsRoutes from './routes/posts.js';
import booksRoutes from './routes/books.js';
import friendsRoutes from './routes/friends.js';

const app = express();

app.set('trust proxy', 1);

app.use(
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                'default-src': ["'self'"],
                'script-src': [
                    "'self'",
                    "'unsafe-inline'",
                    'https://*.clerk.accounts.dev',
                    'https://*.clerk.com',
                    'https://challenges.cloudflare.com',
                ],
                'connect-src': ["'self'", 'https://*.clerk.accounts.dev', 'https://*.clerk.com'],
                'img-src': ["'self'", 'data:', 'blob:', 'https:'],
                'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
                'frame-src': ["'self'", 'https://*.clerk.accounts.dev', 'https://*.clerk.com', 'https://challenges.cloudflare.com'],
                'worker-src': ["'self'", 'blob:'],
            },
        },
        crossOriginEmbedderPolicy: false,
    })
);

app.use(cors({ origin: config.clerk.authorizedParties, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use(
    rateLimit({
        windowMs: 60_000,
        max: 240,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, please slow down.' },
    })
);

// Health
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Inject env into HTML pages so the frontend can pick up Clerk keys at request time.
async function renderPage(filename) {
    const full = path.join(config.publicDir, filename);
    const html = await fs.readFile(full, 'utf8');
    return html
        .replaceAll('{{CLERK_PUBLISHABLE_KEY}}', config.clerk.publishableKey)
        .replaceAll('{{CLERK_JS_URL}}', config.clerk.jsUrl)
        .replaceAll('{{API_BASE}}', '');
}

function pageHandler(filename) {
    return async (_req, res, next) => {
        try {
            const html = await renderPage(filename);
            res.set('Cache-Control', 'no-store').type('html').send(html);
        } catch (err) {
            next(err);
        }
    };
}

app.get('/', pageHandler('index.html'));
app.get('/signin', pageHandler('signin.html'));
app.get('/signup', pageHandler('signin.html'));
app.get('/timeline', pageHandler('timeline.html'));
app.get('/friends', pageHandler('friends.html'));
app.get('/invite/:token', pageHandler('invite.html'));
app.get('/friend/:userId', pageHandler('friend.html'));

// Static assets (CSS, client JS, image uploads)
app.use(
    '/uploads',
    express.static(config.uploadsDir, {
        maxAge: '7d',
        immutable: false,
        fallthrough: false,
    })
);
app.use(
    express.static(config.publicDir, {
        maxAge: config.env === 'production' ? '1h' : 0,
        index: false,
    })
);

// API routes — auth required
app.use('/api', requireAuth);
app.use('/api', withUser);

app.use(meRoutes);
app.use(postsRoutes);
app.use(booksRoutes);
app.use(friendsRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

export default app;
