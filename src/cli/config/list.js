import { listProfiles } from '../../config.js';
import { formatTable } from '../../utils/format.js';

export async function listConfigHandler(argv) {
  const { current, path, profiles } = listProfiles();

  if (argv.json) {
    console.log(JSON.stringify({ current, profiles }, null, 2));
    return;
  }

  if (profiles.length === 0) {
    console.log('(no profiles configured — run `fob-stm config profiles add <name>`)');
    return;
  }

  // Org identity columns appear only once any profile has resolved them (decision G).
  const hasOrg = profiles.some((p) => p.org_slug || p.org_id);

  const headers = hasOrg
    ? ['', 'NAME', 'ORG SLUG', 'ORG ID', 'API URL']
    : ['', 'NAME', 'API URL'];

  const rows = profiles.map((p) => {
    const mark = p.current ? '*' : ' ';
    return hasOrg
      ? [mark, p.name, p.org_slug ?? '', p.org_id ?? '', p.api_url ?? '']
      : [mark, p.name, p.api_url ?? ''];
  });

  console.log(formatTable(headers, rows));
  console.log(`\n(* = current)  config: ${path}`);
}
