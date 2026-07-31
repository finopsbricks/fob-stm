import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = join(mkdtempSync(join(tmpdir(), 'stm-amt-')), 'nested');
process.env.FOB_STM_CONFIG_DIR = dir;

const { setAmountDisplay, getAmountDisplay } = await import('../../src/cli/config-store.js');
const { scaleMilliAmount, resetAmountModeCache, amountMode } = await import('../../src/cli/utils/amounts.js');
const { formatAmount } = await import('../../src/cli/utils/format.js');

describe('amount-display setting', () => {
  it('defaults to actual (÷1000) for scaling and formatting', () => {
    resetAmountModeCache();
    expect(getAmountDisplay()).toBe('actual');
    expect(amountMode()).toBe('actual');
    expect(scaleMilliAmount(1234500)).toBe(1234.5);
    expect(formatAmount(1234500)).toBe('1,234.50');
  });

  it('passes milli-units through untouched in raw mode', () => {
    setAmountDisplay('raw');
    resetAmountModeCache(); // mode is cached per-process; clear it for the test
    expect(getAmountDisplay()).toBe('raw');
    expect(scaleMilliAmount(1234500)).toBe(1234500);
    expect(formatAmount(1234500)).toBe('1,234,500');
  });

  it('leaves null / undefined / empty / zero absent in both modes', () => {
    setAmountDisplay('raw');
    resetAmountModeCache();
    expect(scaleMilliAmount(null)).toBeNull();
    expect(scaleMilliAmount(undefined)).toBeUndefined();
    expect(scaleMilliAmount('')).toBe('');
    // formatAmount suppresses zero/empty regardless of mode
    expect(formatAmount(0)).toBe('');
    expect(formatAmount(null)).toBe('');

    setAmountDisplay('actual');
    resetAmountModeCache();
    expect(scaleMilliAmount(null)).toBeNull();
    expect(formatAmount(0)).toBe('');
  });

  it('rejects unknown modes', () => {
    expect(() => setAmountDisplay('cents')).toThrow(/amount-display must be one of/);
  });
});
