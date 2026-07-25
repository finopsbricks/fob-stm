import { useOrg } from '../../config.js';

export async function useConfigHandler(argv) {
  useOrg(argv.name);
  console.log(`Current profile set to '${argv.name}'.`);
}
