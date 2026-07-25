import { addOrg } from '../../config.js';
import { refreshIdentity } from './_identity.js';

export async function addConfigHandler(argv) {
  addOrg(argv.name, {
    api_url: argv.apiUrl,
    api_key: argv.apiKey,
    api_secret: argv.apiSecret,
  });
  console.log(`Saved statements credentials for profile '${argv.name}'.`);

  // Resolve the org identity so the profile is self-describing. Best-effort:
  // a failed fetch never blocks saving the credentials (WIP decision G).
  if (await refreshIdentity(argv.name)) {
    console.log(`Resolved org identity for '${argv.name}'.`);
  }
}
