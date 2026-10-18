/**
 * Market Intelligence pipeline diagnostics (aggregate-only, read-only).
 *
 * Prints COUNTS and coverage metadata only — never prints licensed market values,
 * row contents, API keys or credentials.
 *
 * Usage:  npx tsx scripts/market-data-diagnostics.ts [subjectTerm]
 *   e.g.  npx tsx scripts/market-data-diagnostics.ts paracetamol
 */
import 'dotenv/config';
import WebSocket from 'ws';
(global as any).WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const key = serviceKey || process.env.SUPABASE_ANON_KEY?.trim();
if (!url || !key) {
  console.error('SUPABASE_URL and a Supabase key are not configured — cannot run diagnostics.');
  process.exit(1);
}
const keyMode = serviceKey ? 'SERVICE_ROLE (RLS bypassed — full aggregate visibility)' : 'ANON (RLS enforced — tenant rows are hidden; zero counts are NOT proof of emptiness)';
const db = createClient(url, key, { auth: { persistSession: false } });
const term = (process.argv[2] || 'paracetamol').toLowerCase();

async function count(table: string, apply?: (q: any) => any) {
  let q: any = db.from(table).select('*', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count: c, error } = await q;
  return error ? `ERROR: ${error.code || ''} ${error.message}` : c;
}

async function main() {
  const out: Record<string, unknown> = {};
  out.keyMode = keyMode;

  // 0. Schema probe — detects unapplied migrations without reading data
  const expected: Record<string, string[]> = {
    market_dataset_versions: ['id', 'organization_id', 'provider', 'reporting_period', 'capabilities', 'status', 'license_status', 'source_type', 'validation_status', 'invalid_count'],
    market_observations: ['id', 'dataset_version_id', 'molecule', 'external_product_name', 'country_name', 'reporting_period', 'sales_value', 'brand_name', 'price_per_unit', 'pack_size', 'source_row_number', 'country_iso', 'region_name', 'source_value_flags'],
    market_data_import_sessions: ['id', 'processing_status', 'valid_count', 'config_json'],
    market_data_staging: ['id', 'raw_values', 'parsed_values', 'validation_state'],
    market_intelligence_settings: ['id', 'organization_id', 'settings'],
  };
  const schema: Record<string, string> = {};
  for (const [table, cols] of Object.entries(expected)) {
    for (const col of cols) {
      const { error } = await db.from(table).select(col).limit(0);
      schema[`${table}.${col}`] = error ? `MISSING (${error.code || error.message})` : 'ok';
    }
  }
  out.schemaProbe = schema;

  // 1. Connector / API configuration (names only)
  out.iqviaEnvVarsConfigured = Object.keys(process.env).filter(k => /IQVIA|MIDAS|IMS_/i.test(k));

  // 2. Registered datasets
  const { data: datasets, error: dsErr } = await db
    .from('market_dataset_versions')
    .select('id, organization_id, dataset_name, provider, status, record_count, created_at');
  out.datasetVersions = dsErr ? `ERROR: ${dsErr.message}` : (datasets || []).map(d => ({
    id: d.id, org: d.organization_id, name: d.dataset_name, provider: d.provider,
    status: d.status, declared_records: d.record_count, created_at: d.created_at,
  }));
  out.legacySeedIdRegistered = Array.isArray(datasets) && datasets.some(d => d.id === 'ds-iqvia-midas-auth-v2');

  // 3. Import pipeline
  out.importSessions = await count('market_data_import_sessions');
  out.stagingRows = await count('market_data_staging');
  out.mappings = await count('market_data_mappings');

  // 4. Published observations
  out.observationsTotal = await count('market_observations');
  if (Array.isArray(datasets)) {
    const per: Record<string, unknown> = {};
    for (const d of datasets) per[d.id] = await count('market_observations', q => q.eq('dataset_version_id', d.id));
    out.observationsPerDataset = per;
  }
  out[`observationsMatching_${term}`] = await count('market_observations', q =>
    q.or(`molecule.ilike.%${term}%,external_product_name.ilike.%${term}%,brand_name.ilike.%${term}%`));

  const { data: periodMin } = await db.from('market_observations').select('reporting_period').order('reporting_period', { ascending: true }).limit(1);
  const { data: periodMax } = await db.from('market_observations').select('reporting_period').order('reporting_period', { ascending: false }).limit(1);
  out.periodCoverage = { min: periodMin?.[0]?.reporting_period ?? null, max: periodMax?.[0]?.reporting_period ?? null };

  // 5. Canonical identity for subject
  out[`productsMatching_${term}`] = await count('products', q => q.or(`product_name.ilike.%${term}%,molecule.ilike.%${term}%,generic_name.ilike.%${term}%`));
  out[`moleculesMatching_${term}`] = await count('molecules', q => q.ilike('canonical_name', `%${term}%`));

  console.log(JSON.stringify(out, null, 2));
}

main().catch(err => { console.error('Diagnostics failed:', err?.message || err); process.exit(1); });
