/**
 * `fob-stm config settings` handlers — global (non-profile) CLI preferences.
 *
 * Today the only setting is `amount_display`, which controls whether milli-unit
 * amounts from the transactions/statements endpoints are shown as human decimals
 * (`actual`, default) or as the API's raw ×1000 integers (`raw`).
 */

import { listSettings, setAmountDisplay, AMOUNT_DISPLAY_MODES } from '../config-store.js';
import { formatField } from '../utils/format.js';

export async function listSettingsHandler(argv) {
  const settings = listSettings();

  if (argv.json) {
    console.log(JSON.stringify(settings, null, 2));
    return;
  }

  const w = 16;
  console.log(formatField('amount-display', settings.amount_display, w));
  console.log(
    `\nactual = amounts divided to decimals (default); raw = API's ×1000 integers.` +
      `\nChange with: fob-stm config settings set amount-display <${AMOUNT_DISPLAY_MODES.join('|')}>`,
  );
}

export async function setSettingsHandler(argv) {
  // yargs gives us `key` and `value` positionals; only amount-display is known.
  const { key, value } = argv;
  if (key !== 'amount-display') {
    throw new Error(`Unknown setting '${key}'. Known settings: amount-display.`);
  }
  const settings = setAmountDisplay(value);
  console.log(`Set amount-display to '${settings.amount_display}'.`);
}
