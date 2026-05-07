import app from './app.js';
import config from './config.js';
import { testConnection } from './db.js';

async function main() {
    await testConnection();

    const server = app.listen(config.port, () => {
        console.log(`[privbook] listening on http://localhost:${config.port}  (env=${config.env})`);
    });

    const shutdown = (signal) => {
        console.log(`[privbook] received ${signal}, shutting down`);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
    console.error('[privbook] failed to start:', err);
    process.exit(1);
});
