import { Router } from 'express';
import pool from '../db.js';

const router = Router();

router.get('/api/me', async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `select id, clerk_user_id, display_name, created_at
             from privbook_users
             where id = $1`,
            [req.ctx.userId]
        );
        res.json({ user: rows[0] ?? null });
    } catch (err) {
        next(err);
    }
});

router.patch('/api/me', async (req, res, next) => {
    try {
        const displayName = typeof req.body?.display_name === 'string'
            ? req.body.display_name.trim().slice(0, 80)
            : null;
        const { rows } = await pool.query(
            `update privbook_users
             set display_name = $1, updated_at = now()
             where id = $2
             returning id, clerk_user_id, display_name, created_at`,
            [displayName || null, req.ctx.userId]
        );
        res.json({ user: rows[0] });
    } catch (err) {
        next(err);
    }
});

export default router;
