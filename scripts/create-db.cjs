const { Client } = require('pg');

async function run() {
  const c = new Client({
    host: '127.0.0.1',
    port: 4538,
    user: 'postgres',
    password: 'vocpos2026',
    database: 'postgres'
  });

  try {
    await c.connect();
    console.log('Terhubung ke PostgreSQL di port 4538');

    const res = await c.query('SELECT datname FROM pg_database ORDER BY datname');
    console.log('\nDatabase yang ada:');
    res.rows.forEach(r => console.log(' -', r.datname));

    try {
      await c.query('CREATE DATABASE "gudangBuah"');
      console.log('\n[OK] Database "gudangBuah" berhasil dibuat!');
    } catch (e) {
      if (e.code === '42P04') {
        console.log('\n[OK] Database "gudangBuah" sudah ada.');
      } else {
        throw e;
      }
    }
  } catch (err) {
    console.error('[ERROR]', err.message);
  } finally {
    await c.end();
  }
}

run();
