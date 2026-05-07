import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool, { testConnection } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    await testConnection();
    const dir = path.resolve(__dirname, 'migrations');
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
        const full = path.join(dir, file);
        const sql = await fs.readFile(full, 'utf8');
        console.log(`[migrate] applying ${file}`);
        await pool.query(sql);
    }

    console.log('[migrate] done');
    await pool.end();
}

main().catch((err) => {
    console.error('[migrate] failed:', err);
    process.exit(1);
});
