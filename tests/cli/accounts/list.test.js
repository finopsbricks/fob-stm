import { jest } from '@jest/globals';
import { captureOutput } from '../../helpers.js';

// Mock the client (no network) and the config store (no filesystem).
jest.unstable_mockModule('../../../src/client.js', () => ({
  getAccounts: jest.fn(),
  getAllAccounts: jest.fn(),
}));
jest.unstable_mockModule('../../../src/config.js', () => ({
  resolveCredentials: jest.fn(() => ({ api_url: 'https://x/', api_key: 'k', api_secret: 's', source: 'env' })),
  setOrgOverride: jest.fn(),
}));

const { getAccounts, getAllAccounts } = await import('../../../src/client.js');
const { listAccountsHandler } = await import('../../../src/cli/accounts/list.js');

describe('listAccountsHandler', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('renders a table of accounts and calls the client with paging + filters', async () => {
    getAccounts.mockResolvedValue({
      data: [{ id: '1', name: 'Acme Bank', category: 'bank', acc_no: '001', currency: 'INR', status: 'active' }],
      page_context: { has_more: false },
    });

    await listAccountsHandler({ page: 1, limit: 100, category: 'bank' });

    expect(getAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100, category: 'bank' }),
      expect.objectContaining({ api_key: 'k' }),
    );
    expect(out.stdout).toContain('Acme Bank');
  });

  it('prints (no accounts) when the result is empty', async () => {
    getAccounts.mockResolvedValue({ data: [], page_context: {} });
    await listAccountsHandler({ page: 1, limit: 100 });
    expect(out.stdout).toContain('(no accounts)');
  });

  it('emits raw JSON via --json using the auto-paginating client', async () => {
    getAllAccounts.mockResolvedValue({ data: [{ id: '1', name: 'Acme' }], page_context: {}, truncated: false });
    await listAccountsHandler({ json: true });
    expect(getAllAccounts).toHaveBeenCalled();
    expect(out.stdout).toContain('"name": "Acme"');
  });
});
