import { useOrg } from '../../config.js';

export async function useConfigHandler(argv) {
  useOrg(argv.org);
  console.log(`Current org set to '${argv.org}'.`);
}
