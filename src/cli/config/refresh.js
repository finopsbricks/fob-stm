import { listProfiles } from '../config-store.js';
import { refreshIdentity } from './_identity.js';

export async function refreshConfigHandler(argv) {
  const { profiles } = listProfiles();

  let names;
  if (argv.all) {
    names = profiles.map((p) => p.name);
  } else if (argv.name) {
    names = [argv.name];
  } else {
    throw new Error('Specify a profile name, or --all to refresh every profile.');
  }

  if (names.length === 0) {
    console.log('(no profiles to refresh)');
    return;
  }

  let ok = 0;
  for (const name of names) {
    if (await refreshIdentity(name)) {
      ok++;
      console.log(`Refreshed '${name}'.`);
    }
  }
  console.log(`Refreshed ${ok}/${names.length} profile(s).`);
}
