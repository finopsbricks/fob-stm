/**
 * Milli-unit amount scaling, governed by the `amount_display` setting.
 *
 * The statements API returns transaction and statement amounts as integers
 * scaled ×1000 (so ₹1,234.50 arrives as 1234500) to keep exact arithmetic.
 * `amount_display` decides whether the CLI converts those back to human decimals
 * (`actual`, the default) or passes the raw integer through (`raw`). Only fields
 * from milli-unit endpoints go through here — other endpoints already return
 * decimals from the API and must not be re-scaled.
 *
 * The mode is read once and cached: a single list can render thousands of rows,
 * and the setting can't change mid-invocation.
 */

import { getAmountDisplay } from '../config-store.js';

let cachedMode;

/** @returns {'actual'|'raw'} the resolved amount-display mode for this process. */
export function amountMode() {
  return (cachedMode ??= getAmountDisplay());
}

/** Reset the cached mode. Test-only — real invocations resolve the mode once. */
export function resetAmountModeCache() {
  cachedMode = undefined;
}

/**
 * Scale a raw milli-unit value for machine output (JSON/CSV). Returns a Number
 * in `actual` mode (÷1000) or the untouched value in `raw` mode. null/undefined
 * and empty string pass through unchanged so absent fields stay absent.
 */
export function scaleMilliAmount(value) {
  if (value == null || value === '') return value;
  return amountMode() === 'raw' ? Number(value) : Number(value) / 1000;
}
