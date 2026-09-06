import pg from "pg";

const { Pool } = pg;
let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add a Postgres database (e.g. Railway's Postgres plugin, " +
        "or a free Neon/Supabase project for local dev) and set DATABASE_URL in the environment."
      );
    }
    // Managed Postgres (Railway, Neon, Supabase, ...) needs TLS; set PGSSL=disable
    // for a plain local Postgres that isn't configured for it.
    const ssl = process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false };
    pool = new Pool({ connectionString, ssl });
  }
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

// Runs several statements as one transaction. `fn` receives a client with the
// same .query(text, params) signature; nothing commits until fn resolves.
export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Builds one multi-row INSERT (INSERT INTO t (a,b) VALUES ($1,$2),($3,$4),...)
// instead of one round trip per row. No-ops if `rows` is empty. Chunks large
// batches so a growing table (months of billing history) never approaches
// Postgres's ~65535-parameter-per-query ceiling.
export async function bulkInsert(client, table, columns, rows) {
  if (!rows.length) return;
  const maxRowsPerChunk = Math.max(1, Math.floor(5000 / columns.length));
  for (let start = 0; start < rows.length; start += maxRowsPerChunk) {
    const chunk = rows.slice(start, start + maxRowsPerChunk);
    const values = [];
    const tuples = chunk.map((row, i) => {
      const base = i * columns.length;
      columns.forEach((col) => values.push(row[col]));
      return `(${columns.map((_, j) => `$${base + j + 1}`).join(",")})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${tuples.join(",")}`,
      values
    );
  }
}

export async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      id INT PRIMARY KEY DEFAULT 1,
      exchange_rate NUMERIC NOT NULL DEFAULT 89000,
      current_month TEXT NOT NULL,
      CHECK (id = 1)
    );
    CREATE TABLE IF NOT EXISTS subscribers (
      id INT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      family_name TEXT NOT NULL DEFAULT '',
      father_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      box TEXT NOT NULL DEFAULT '',
      amps NUMERIC NOT NULL DEFAULT 0,
      security_deposit_usd NUMERIC NOT NULL DEFAULT 0,
      billing_type TEXT NOT NULL DEFAULT 'METER'
    );
    CREATE TABLE IF NOT EXISTS monthly_bills (
      id INT PRIMARY KEY,
      month TEXT NOT NULL,
      subscriber_id INT NOT NULL,
      prev NUMERIC NOT NULL DEFAULT 0,
      curr NUMERIC NOT NULL DEFAULT 0,
      price_per_amp_usd NUMERIC NOT NULL DEFAULT 0,
      subscription_fee_usd NUMERIC NOT NULL DEFAULT 0,
      discount_usd NUMERIC NOT NULL DEFAULT 0,
      last_debt_usd NUMERIC NOT NULL DEFAULT 0,
      paid_usd NUMERIC NOT NULL DEFAULT 0,
      printed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS pricing (
      amps NUMERIC PRIMARY KEY,
      price_usd NUMERIC NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pricing_by_month (
      month TEXT NOT NULL,
      amps NUMERIC NOT NULL,
      price_usd NUMERIC NOT NULL,
      PRIMARY KEY (month, amps)
    );
    CREATE TABLE IF NOT EXISTS thabet_pricing (
      amps NUMERIC PRIMARY KEY,
      price_usd NUMERIC NOT NULL
    );
    CREATE TABLE IF NOT EXISTS thabet_pricing_by_month (
      month TEXT NOT NULL,
      amps NUMERIC NOT NULL,
      price_usd NUMERIC NOT NULL,
      PRIMARY KEY (month, amps)
    );
  `);
}
