import { Router } from 'express';
import pool from '../db.js';
import config from '../config.js';
import { uploadMiddleware, processImage, deleteStoredImage } from '../upload.js';
import { parseBookIds } from './books.js';

const router = Router();

const ALLOWED_LAYOUTS = new Set(['auto', 'grid', 'collage', 'single']);

function sanitizeBody(raw) {
    if (typeof raw !== 'string') return '';
    return raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 8000);
}

async function loadPostWithImages(postId, userId) {
    const { rows: postRows } = await pool.query(
        `select id, body, layout, created_at, updated_at
         from privbook_posts
         where id = $1 and user_id = $2`,
        [postId, userId]
    );
    if (postRows.length === 0) return null;

    const { rows: images } = await pool.query(
        `select id, url, width, height, position
         from privbook_post_images
         where post_id = $1
         order by position asc, created_at asc`,
        [postId]
    );

    const { rows: books } = await pool.query(
        `select b.id, b.name, b.color
         from privbook_books b
         join privbook_post_books pb on pb.book_id = b.id
         where pb.post_id = $1
         order by lower(b.name) asc`,
        [postId]
    );

    return { ...postRows[0], images, books };
}

/**
 * GET /api/posts?cursor=<created_at>&limit=20
 * Cursor-paginated timeline of the current user's own posts.
 */
router.get('/api/posts', async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit ?? '20', 10) || 20, 50);
        const cursor = req.query.cursor;
        const bookId = typeof req.query.book_id === 'string' && req.query.book_id ? req.query.book_id : null;

        const params = [req.ctx.userId];
        let where = 'where p.user_id = $1';
        if (cursor) {
            params.push(cursor);
            where += ` and p.created_at < $${params.length}`;
        }
        if (bookId) {
            params.push(bookId);
            where += ` and exists (
                select 1 from privbook_post_books pb
                where pb.post_id = p.id and pb.book_id = $${params.length}
            )`;
        }
        params.push(limit + 1);

        const { rows } = await pool.query(
            `select p.id, p.body, p.layout, p.created_at, p.updated_at,
                    coalesce((
                        select json_agg(
                            json_build_object(
                                'id', i.id, 'url', i.url,
                                'width', i.width, 'height', i.height,
                                'position', i.position
                            ) order by i.position asc, i.created_at asc
                        )
                        from privbook_post_images i
                        where i.post_id = p.id
                    ), '[]'::json) as images,
                    coalesce((
                        select json_agg(
                            json_build_object('id', b.id, 'name', b.name, 'color', b.color)
                            order by lower(b.name) asc
                        )
                        from privbook_books b
                        join privbook_post_books pb on pb.book_id = b.id
                        where pb.post_id = p.id
                    ), '[]'::json) as books
             from privbook_posts p
             ${where}
             order by p.created_at desc
             limit $${params.length}`,
            params
        );

        const hasMore = rows.length > limit;
        const items = hasMore ? rows.slice(0, limit) : rows;
        const nextCursor = hasMore ? items[items.length - 1].created_at : null;

        res.json({ items, nextCursor });
    } catch (err) {
        next(err);
    }
});

router.get('/api/posts/:id', async (req, res, next) => {
    try {
        const post = await loadPostWithImages(req.params.id, req.ctx.userId);
        if (!post) return res.status(404).json({ error: 'Not found' });
        res.json({ post });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/posts
 * multipart/form-data:
 *   - body: text (optional, max 8000 chars)
 *   - layout: 'auto' | 'grid' | 'collage' | 'single' (optional, default 'auto')
 *   - images: 0..MAX_IMAGES_PER_POST files
 * Must include at least body OR one image.
 */
router.post('/api/posts', uploadMiddleware.array('images', config.upload.maxImagesPerPost), async (req, res, next) => {
    const files = req.files ?? [];
    const body = sanitizeBody(req.body?.body);
    const layout = ALLOWED_LAYOUTS.has(req.body?.layout) ? req.body.layout : 'auto';

    let createdAt = null;
    if (typeof req.body?.created_at === 'string' && req.body.created_at) {
        const d = new Date(req.body.created_at);
        if (isNaN(d.getTime())) {
            return res.status(400).json({ error: 'That date doesn’t look right.' });
        }
        const min = Date.UTC(1900, 0, 1);
        const max = Date.now() + 24 * 60 * 60 * 1000;
        if (d.getTime() < min || d.getTime() > max) {
            return res.status(400).json({ error: 'Pick a date between 1900 and today.' });
        }
        createdAt = d.toISOString();
    }

    const requestedBookIds = parseBookIds(req.body?.book_ids);

    if (!body && files.length === 0) {
        return res.status(400).json({ error: 'A post needs either text or at least one image.' });
    }

    const processed = [];
    try {
        for (const file of files) {
            const img = await processImage(file.buffer, req.ctx.userId);
            processed.push(img);
        }
    } catch (err) {
        for (const p of processed) await deleteStoredImage(p.storageKey);
        return next(err);
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: postRows } = await client.query(
            `insert into privbook_posts (user_id, body, layout, created_at)
             values ($1, $2, $3, coalesce($4::timestamptz, now()))
             returning id, body, layout, created_at, updated_at`,
            [req.ctx.userId, body, layout, createdAt]
        );
        const post = postRows[0];

        for (let i = 0; i < processed.length; i++) {
            const img = processed[i];
            await client.query(
                `insert into privbook_post_images
                    (post_id, url, storage_key, width, height, position)
                 values ($1, $2, $3, $4, $5, $6)`,
                [post.id, img.url, img.storageKey, img.width, img.height, i]
            );
        }

        if (requestedBookIds.length > 0) {
            const { rows: validBooks } = await client.query(
                'select id from privbook_books where user_id = $1 and id = any($2::uuid[])',
                [req.ctx.userId, requestedBookIds]
            );
            for (const b of validBooks) {
                await client.query(
                    `insert into privbook_post_books (post_id, book_id)
                     values ($1, $2)
                     on conflict do nothing`,
                    [post.id, b.id]
                );
            }
        }

        await client.query('COMMIT');

        const full = await loadPostWithImages(post.id, req.ctx.userId);
        res.status(201).json({ post: full });
    } catch (err) {
        await client.query('ROLLBACK');
        for (const p of processed) await deleteStoredImage(p.storageKey);
        next(err);
    } finally {
        client.release();
    }
});

router.patch('/api/posts/:id', async (req, res, next) => {
    try {
        const updates = [];
        const params = [];
        if (typeof req.body?.body === 'string') {
            params.push(sanitizeBody(req.body.body));
            updates.push(`body = $${params.length}`);
        }
        if (typeof req.body?.layout === 'string' && ALLOWED_LAYOUTS.has(req.body.layout)) {
            params.push(req.body.layout);
            updates.push(`layout = $${params.length}`);
        }
        if (typeof req.body?.created_at === 'string') {
            const d = new Date(req.body.created_at);
            if (isNaN(d.getTime())) {
                return res.status(400).json({ error: 'That date doesn’t look right.' });
            }
            const min = Date.UTC(1900, 0, 1);
            const max = Date.now() + 24 * 60 * 60 * 1000;
            if (d.getTime() < min || d.getTime() > max) {
                return res.status(400).json({ error: 'Pick a date between 1900 and today.' });
            }
            params.push(d.toISOString());
            updates.push(`created_at = $${params.length}`);
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nothing to update.' });
        }
        updates.push('updated_at = now()');
        params.push(req.params.id, req.ctx.userId);

        const { rowCount } = await pool.query(
            `update privbook_posts
             set ${updates.join(', ')}
             where id = $${params.length - 1} and user_id = $${params.length}`,
            params
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Not found' });

        const full = await loadPostWithImages(req.params.id, req.ctx.userId);
        res.json({ post: full });
    } catch (err) {
        next(err);
    }
});

router.delete('/api/posts/:id', async (req, res, next) => {
    try {
        const { rows: imageRows } = await pool.query(
            `select i.storage_key
             from privbook_post_images i
             join privbook_posts p on p.id = i.post_id
             where i.post_id = $1 and p.user_id = $2`,
            [req.params.id, req.ctx.userId]
        );

        const { rowCount } = await pool.query(
            'delete from privbook_posts where id = $1 and user_id = $2',
            [req.params.id, req.ctx.userId]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Not found' });

        for (const r of imageRows) await deleteStoredImage(r.storage_key);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

export default router;
