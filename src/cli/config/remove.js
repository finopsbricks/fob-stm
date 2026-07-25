import { removeOrg } from '../../config.js';

export async function removeConfigHandler(argv) {
  removeOrg(argv.name);
  console.log(`Removed profile '${argv.name}'.`);
}
