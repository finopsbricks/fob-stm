import { jest } from '@jest/globals';
import { captureOutput } from '../../helpers.js';

// The CLI handler is presentation-only now, so mock the client namespace it
// drives (via clientFor) rather than the transport. This is the payoff of the
// resource-layer split: CLI tests assert rendering, not HTTP.
const accounts = { list: jest.fn(), getAll: jest.fn() };
jest.unstable_mockModule('../../../src/cli/_helpers.js', () => ({
  clientFor: jest.fn(() => ({ accounts })),
}));
jest.unstable_mockModule('../../../src/http.js', () => ({ MAX_ALL_ROWS: 15000 }));

const { listAccountsHandler } = await import('../../../src/cli/accounts/list.js');

describe('listAccountsHandler', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('renders a table via accounts.list with paging + filters', async () => {
    accounts.list.mockResolvedValue({
      data: [{ id: '1', name: 'Acme Bank', category: 'bank', acc_no: '001', currency: 'INR', status: 'active' }],
      page_context: { has_more: false },
    });

    await listAccountsHandler({ page: 1, limit: 100, category: 'bank' });

    expect(accounts.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100, category: 'bank' }),
    );
    expect(out.stdout).toContain('Acme Bank');
  });

  it('prints (no accounts) when the page is empty', async () => {
    accounts.list.mockResolvedValue({ data: [], page_context: {} });
    await listAccountsHandler({ page: 1, limit: 100 });
    expect(out.stdout).toContain('(no accounts)');
  });

  it('bare --json fetches a single page via accounts.list (scope is independent of format)', async () => {
    accounts.list.mockResolvedValue({ data: [{ id: '1', name: 'Acme' }], page_context: { has_more: false } });
    await listAccountsHandler({ page: 1, limit: 100, json: true });
    expect(accounts.list).toHaveBeenCalled();
    expect(accounts.getAll).not.toHaveBeenCalled();
    expect(out.stdout).toContain('"name": "Acme"');
  });

  it('uses the auto-paginating accounts.getAll for --all --json', async () => {
    accounts.getAll.mockResolvedValue([{ id: '1', name: 'Acme' }]);
    await listAccountsHandler({ all: true, json: true });
    expect(accounts.getAll).toHaveBeenCalled();
    expect(out.stdout).toContain('"name": "Acme"');
  });

  it('--limit/--page under --json return that one page, not the full set', async () => {
    accounts.list.mockResolvedValue({
      data: [{ id: '2', name: 'Page 2 Acct' }],
      page_context: { has_more: false },
    });
    await listAccountsHandler({ page: 2, limit: 500, json: true });
    expect(accounts.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 500 }));
    expect(accounts.getAll).not.toHaveBeenCalled();
  });
});
