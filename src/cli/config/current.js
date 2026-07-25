import { describeCurrent } from '../../config.js';

export async function currentConfigHandler(argv) {
  const cur = describeCurrent();

  if (argv.json) {
    console.log(JSON.stringify(cur, null, 2));
    return;
  }

  if (!cur) {
    console.log('(no active profile — run `fob-stm config profiles add <name>`, or set FOB_STM_API_*)');
    return;
  }

  const lines = [`Source:   ${cur.source}`];
  if (cur.name) lines.push(`Profile:  ${cur.name}`);
  if (cur.org_slug || cur.org_id || cur.org_name) {
    const org = cur.org_name ?? cur.org_slug ?? '—';
    lines.push(`Org:      ${org}${cur.org_slug && cur.org_name ? ` (${cur.org_slug})` : ''}`);
    if (cur.org_id) lines.push(`Org ID:   ${cur.org_id}`);
  }
  lines.push(`API URL:  ${cur.api_url}`);
  console.log(lines.join('\n'));
}
