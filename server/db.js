import pg from 'pg';
import config from './config.js';

const { Pool } = pg;

const pool = new Pool({ ...config.db, max: 10, idleTimeoutMillis: 30_000 });

pool.on('error', (err) => {
    console.error('[pg] idle client error', err);
});

export async function testConnection() {
    await pool.query('select 1');
    console.log('[pg] connected to', config.db.host, '/', config.db.database);
}

export default pool;
