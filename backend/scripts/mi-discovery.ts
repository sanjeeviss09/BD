/**
 * Read-only diagnostic: inspects the live Supabase database for Market Intelligence
 * related tables, row counts and permissions. Performs NO writes.
 * Usage: npx tsx scripts/mi-discovery.ts
 */
import { supabaseAdmin } from '../src/db/supabase';

const TABLES = [
  'organizations', 'user_profiles', 'roles', 'user_roles', 'permissions', 'role_permissions', 'audit_logs',
  'products', 'molecules', 'molecule_aliases', 'product_presentations', 'product_aliases', 'countries',
  'market_analysis_contexts', 'market_analysis_snapshots', 'market_dataset_versions',
  'market_data_import_sessions', 'market_data_mappings', 'market_data_staging', 'market_observations',
  'export_templates', 'export_records',
  'market_data_sources', 'market_datasets', 'market_companies', 'market_entity_matches',
];

async function main() {
  for (const t of TABLES) {
    const { count, error } = await supabaseAdmin.from(t).select('*', { count: 'exact', head: true });
    console.log(`${t.padEnd(32)} ${error ? 'MISSING/ERR: ' + error.message : count}`);
  }

  const { data: perms } = await supabaseAdmin.from('permissions').select('code').or('code.ilike.market%,code.ilike.MARKET%');
  console.log('\nmarket permissions:', (perms || []).map((p: any) => p.code));

  const { data: ds } = await supabaseAdmin.from('market_dataset_versions').select('*').limit(5);
  console.log('\nsample datasets:', JSON.stringify(ds, null, 1));

  const { data: obsCols, error: obsErr } = await supabaseAdmin.from('market_observations').select('*').limit(1);
  console.log('\nobservation sample/err:', obsErr?.message || JSON.stringify(obsCols));

  const { data: orgs } = await supabaseAdmin.from('organizations').select('id, name');
  console.log('\norgs:', JSON.stringify(orgs));

  const { data: prods } = await supabaseAdmin.from('products').select('id, organization_id, product_name, molecule, molecule_id, status').limit(20);
  console.log('\nproducts:', JSON.stringify(prods, null, 1));

  const { data: mols } = await supabaseAdmin.from('molecules').select('id, organization_id, canonical_name').limit(50);
  console.log('\nmolecules:', JSON.stringify(mols));

  const { data: prof } = await supabaseAdmin.from('user_profiles').select('id, auth_user_id, organization_id, email');
  console.log('\nprofiles:', JSON.stringify(prof));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
