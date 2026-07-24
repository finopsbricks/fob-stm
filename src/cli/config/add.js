import { addOrg } from '../../config.js';

export async function addConfigHandler(argv) {
  addOrg(argv.org, {
    api_url: argv.apiUrl,
    api_key: argv.apiKey,
    api_secret: argv.apiSecret,
  });
  console.log(`Saved statements credentials for org '${argv.org}'.`);
}
