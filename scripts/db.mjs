// Dev database helper: `npm run db:migrate` and `npm run db:seed`.
// Needs DATABASE_URL (the dev project's Postgres connection string) in .env.local or .env.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTION_REF = "yupitnoeqvifjfvxddob";

for (const file of [".env.local", ".env"]) {
  try { process.loadEnvFile(path.join(root, file)); } catch { /* file not present */ }
}

const url = process.env.DATABASE_URL;
if (!url) fail("DATABASE_URL is missing. Add it to .env.local (Supabase dashboard > Connect > Session pooler).");
if (url.includes(PRODUCTION_REF)) fail("DATABASE_URL points at the production project. These scripts only run against dev.");

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function migrate() {
  await client.query(`create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text)`);
  const done = new Set((await client.query("select version from supabase_migrations.schema_migrations")).rows.map((r) => r.version));
  const dir = path.join(root, "supabase", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  let applied = 0;
  for (const file of files) {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    if (done.has(version)) { console.log(`skip   ${file}`); continue; }
    const sql = await readFile(path.join(dir, file), "utf8");
    try {
      await client.query(sql);
    } catch (error) {
      await client.query("rollback").catch(() => {});
      fail(`${file} failed: ${error.message}`);
    }
    await client.query("insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)", [version, rest.join("_"), [sql]]);
    console.log(`apply  ${file}`);
    applied += 1;
  }
  console.log(applied ? `Done: ${applied} migration(s) applied.` : "Already up to date.");
}

async function seed() {
  try {
    await client.query(await readFile(path.join(root, "supabase", "seed.sql"), "utf8"));
  } catch (error) {
    await client.query("rollback").catch(() => {});
    fail(`seed.sql failed: ${error.message}`);
  }
  const { rows } = await client.query("select count(*)::int as n from public.players");
  console.log(`Seed done. Players in database: ${rows[0].n}`);
}

const commands = { migrate, seed };
const command = commands[process.argv[2]];
if (!command) fail("Usage: node scripts/db.mjs <migrate|seed>");

await client.connect();
try { await command(); } finally { await client.end(); }
