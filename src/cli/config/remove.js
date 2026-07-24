import { removeOrg } from '../../config.js';

export async function removeConfigHandler(argv) {
  removeOrg(argv.org);
  console.log(`Removed org '${argv.org}'.`);
}
