import { jest } from '@jest/globals';
import { captureOutput } from '../../helpers.js';

// Mock the transport (no network) and the config store (no filesystem).
jest.unstable_mockModule('../../../src/http.js', () => ({
  apiGet: jest.fn(),
  apiGetAll: jest.fn(),
}));
jest.unstable_mockModule('../../../src/config.js', () => ({
  resolveCredentials: jest.fn(() => ({ api_url: 'https://x/', api_key: 'k', api_secret: 's', source: 'env' })),
  setOrgOverride: jest.fn(),
}));

const { apiGet, apiGetAll } = await import('../../../src/http.js');
const { listAccountsHandler } = await import('../../../src/cli/accounts/list.js');

describe('listAccountsHandler', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('renders a table and calls apiGet with paging, filters, and threaded credentials', async () => {
    apiGet.mockResolvedValue({
      data: [{ id: '1', name: 'Acme Bank', category: 'bank', acc_no: '001', currency: 'INR', status: 'active' }],
      page_context: { has_more: false },
    });

    await listAccountsHandler({ page: 1, limit: 100, category: 'bank' });

    expect(apiGet).toHaveBeenCalledWith(
      '/api/v1/accounts',
      expect.objectContaining({
        searchParams: expect.objectContaining({ page: 1, limit: 100, category: 'bank' }),
        credentials: expect.objectContaining({ api_key: 'k' }),
      }),
    );
    expect(out.stdout).toContain('Acme Bank');
  });

  it('prints (no accounts) when the result is empty', async () => {
    apiGet.mockResolvedValue({ data: [], page_context: {} });
    await listAccountsHandler({ page: 1, limit: 100 });
    expect(out.stdout).toContain('(no accounts)');
  });

  it('uses the auto-paginating apiGetAll for --json', async () => {
    apiGetAll.mockResolvedValue({ data: [{ id: '1', name: 'Acme' }], page_context: {}, truncated: false });
    await listAccountsHandler({ json: true });
    expect(apiGetAll).toHaveBeenCalled();
    expect(out.stdout).toContain('"name": "Acme"');
  });
});
