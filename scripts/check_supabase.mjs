import fs from 'fs';
import path from 'path';

function parseDotEnv(contents) {
  const lines = contents.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    let key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env not found in cwd. Run this from the project root (people-hub).');
    process.exit(2);
  }

  const contents = fs.readFileSync(envPath, 'utf8');
  const env = parseDotEnv(contents);

  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    console.error('VITE_SUPABASE_URL is missing in .env');
    process.exit(2);
  }

  const key = serviceKey || anonKey;
  if (!key) {
    console.error('No Supabase key found in .env (service role or publishable)');
    process.exit(2);
  }

  console.log('Checking Supabase REST endpoint (project:', env.VITE_SUPABASE_PROJECT_ID || 'unknown', ')');

  try {
    const restUrl = `${url.replace(/\/?$/, '')}/rest/v1/appraisals?select=id&limit=1`;
    const res = await fetch(restUrl, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
      },
    });

    if (res.status === 404) {
      console.error("Table 'public.appraisals' not found (404)");
      process.exit(3);
    }

    if (!res.ok) {
      const text = await res.text();
      console.error('Query error:', res.status, text);
      process.exit(4);
    }

    const data = await res.json();
    console.log("Table 'appraisals' exists. Sample row count:", Array.isArray(data) ? data.length : 0);
    process.exit(0);
  } catch (e) {
    console.error('Unexpected error:', String(e));
    process.exit(5);
  }
}

main();
