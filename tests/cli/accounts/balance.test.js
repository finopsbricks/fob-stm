import { jest } from '@jest/globals';
import { captureOutput } from '../../helpers.js';

const actual = await import('../../../src/cli/_helpers.js');
const accounts = { balance: jest.fn() };
jest.unstable_mockModule('../../../src/cli/_helpers.js', () => ({
  ...actual,
  clientFor: jest.fn(() => ({ accounts })),
}));

const { buildAccountsCommand } = await import('../../../src/cli/accounts/index.js');

const BODY = { account_id: 'acc1', account_name: 'Acme Bank', as_of_date: '2024-03-31', balance: 1250.5 };

/** Run `accounts <args>` through commander, as the CLI does. */
async function runAccounts(args) {
  await buildAccountsCommand().parseAsync(args, { from: 'user' });
}

describe('accounts balance', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    accounts.balance.mockResolvedValue(BODY);
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('passes the date argument to the API', async () => {
    await runAccounts(['balance', 'acc1', '2024-03-31']);
    expect(accounts.balance).toHaveBeenCalledWith('acc1', '2024-03-31');
    expect(out.stdout).toContain('EOD balance for Acme Bank (acc1) on 2024-03-31 = 1,250.50');
  });

  it('defaults to today when no date is given', async () => {
    await runAccounts(['balance', 'acc1']);
    expect(accounts.balance).toHaveBeenCalledWith('acc1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});
