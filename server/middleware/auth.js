import { clerkMiddleware, getAuth } from '@clerk/express';
import config from '../config.js';
import pool from '../db.js';

const middleware = clerkMiddleware({
    authorizedParties: config.clerk.authorizedParties,
});

function enforceJson(req, res, next) {
    const auth = getAuth(req);
    if (!auth?.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

/**
 * Combined: parse Clerk session, then require an authenticated user
 * (responding with 401 JSON instead of a redirect — this is an API).
 * Mounted on `/api`.
 */
export const requireAuth = [middleware, enforceJson];

/**
 * After Clerk auth, look up (or create) the local privbook_users row
 * and attach { clerkUserId, userId } to req.ctx.
 */
export async function withUser(req, res, next) {
    try {
        const auth = getAuth(req);
        const clerkUserId = auth?.userId;
        if (!clerkUserId) {
            return res.status(401).json({ error: 'Missing user identity' });
        }

        const existing = await pool.query(
            'select id from privbook_users where clerk_user_id = $1',
            [clerkUserId]
        );

        let userId;
        if (existing.rows.length > 0) {
            userId = existing.rows[0].id;
        } else {
            const inserted = await pool.query(
                `insert into privbook_users (clerk_user_id) values ($1)
                 on conflict (clerk_user_id) do update set updated_at = now()
                 returning id`,
                [clerkUserId]
            );
            userId = inserted.rows[0].id;
        }

        req.ctx = { clerkUserId, userId };
        next();
    } catch (err) {
        next(err);
    }
}
