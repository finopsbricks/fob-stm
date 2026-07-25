import { getIdentity } from '../../client.js';
import { getProfileCredentials, setProfileIdentity } from '../../config.js';

/**
 * Resolve a profile's server-side org identity (whoami) and cache it as
 * non-secret metadata. Never throws: on failure (offline, endpoint down, empty
 * response) it warns on stderr and leaves the profile unchanged — so adding or
 * keeping credentials never depends on a network round-trip (WIP decision G).
 *
 * @returns {Promise<boolean>} whether identity was resolved and stored.
 */
export async function refreshIdentity(name) {
  try {
    const id = await getIdentity(getProfileCredentials(name));
    if (!id?.org_id) {
      console.error(`(could not resolve org identity for '${name}': empty response)`);
      return false;
    }
    setProfileIdentity(name, id);
    return true;
  } catch (err) {
    console.error(`(could not resolve org identity for '${name}': ${err.message})`);
    return false;
  }
}
