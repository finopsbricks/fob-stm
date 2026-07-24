import { listOrgs } from '../../config.js';

export async function listConfigHandler(argv) {
  const { current, orgs } = listOrgs();

  if (argv.json) {
    console.log(JSON.stringify({ current, orgs }, null, 2));
    return;
  }

  if (orgs.length === 0) {
    console.log('(no orgs configured — run `fob-stm config add <org>`)');
    return;
  }

  for (const name of orgs) {
    console.log(`${name === current ? '* ' : '  '}${name}`);
  }
}
