import multer from 'multer';

export function errorHandler(err, req, res, _next) {
    if (err instanceof multer.MulterError) {
        const map = {
            LIMIT_FILE_SIZE: 'One or more images is too large.',
            LIMIT_FILE_COUNT: 'Too many images for one post.',
            LIMIT_UNEXPECTED_FILE: 'Unexpected upload field.',
        };
        return res.status(400).json({ error: map[err.code] ?? err.message });
    }

    if (err?.status === 401 || err?.statusCode === 401 || err?.code === 'CLERK_AUTH_ERROR') {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const status = err?.status ?? err?.statusCode ?? 500;
    if (status === 404) {
        return res.status(404).json({ error: err?.publicMessage ?? 'Not found' });
    }

    console.error('[error]', err);
    res.status(status).json({
        error: err?.publicMessage ?? 'Internal server error',
    });
}
