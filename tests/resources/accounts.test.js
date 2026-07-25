import { jest } from '@jest/globals';

// Data-layer contract for the accounts namespace. Exercises the real
// fobStm -> resources/accounts -> http.js path with a mocked global fetch (no
// module mocks), so URL building, credential binding, category-based return
// shapes, and pagination are all under test.
const { fobStm } = await import('../../src/index.js');

/** Queue fetch responses; each call shifts the next. Records requests. */
function mockFetch(responses) {
  const calls = [];
  global.fetch = jest.fn(async (url, init) => {
    calls.push({ url: String(url), init, method: init?.method });
    const body = responses.shift() ?? { data: [], page_context: { has_more: false } };
    return { ok: true, status: 200, statusText: 'OK', text: async () => JSON.stringify(body) };
  });
  return calls;
}

const CREDS = { api_url: 'https://statements.finopsbricks.com', api_key: 'k', api_secret: 's' };

describe('accounts resource namespace (via fobStm)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('get() returns the unwrapped record', async () => {
    mockFetch([{ data: { id: '7', name: 'Acme' } }]);
    const acct = await fobStm(CREDS).accounts.get('7');
    expect(acct).toEqual({ id: '7', name: 'Acme' });
  });

  it('list() returns the { data, page_context } envelope', async () => {
    mockFetch([{ data: [{ id: '1' }], page_context: { has_more: false } }]);
    const res = await fobStm(CREDS).accounts.list({ category: 'bank' });
    expect(res.data).toEqual([{ id: '1' }]);
    expect(res.page_context).toEqual({ has_more: false });
  });

  it('getAll() flattens pages into a plain array', async () => {
    mockFetch([
      { data: [{ id: '1' }, { id: '2' }], page_context: { has_more: true } },
      { data: [{ id: '3' }], page_context: { has_more: false } },
    ]);
    const all = await fobStm(CREDS).accounts.getAll();
    expect(all.map((a) => a.id)).toEqual(['1', '2', '3']);
  });

  it('create() POSTs to /api/v1/accounts and returns the created record', async () => {
    const calls = mockFetch([{ data: { id: '9', name: 'New' } }]);
    const created = await fobStm(CREDS).accounts.create({ name: 'New' });
    expect(created).toEqual({ id: '9', name: 'New' });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('https://statements.finopsbricks.com/api/v1/accounts');
    expect(JSON.parse(calls[0].init.body)).toEqual({ name: 'New' });
  });

  it('retire() PUTs status=retired to the account path', async () => {
    const calls = mockFetch([{ data: { id: '7', status: 'retired' } }]);
    await fobStm(CREDS).accounts.retire('7');
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toBe('https://statements.finopsbricks.com/api/v1/accounts/7');
    expect(JSON.parse(calls[0].init.body)).toEqual({ status: 'retired' });
  });

  it('delete() issues a DELETE to the account path', async () => {
    const calls = mockFetch([{ data: null }]);
    await fobStm(CREDS).accounts.delete('7');
    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].url).toBe('https://statements.finopsbricks.com/api/v1/accounts/7');
  });

  it('binds credentials per client (multi-org)', async () => {
    const calls = mockFetch([{ data: { id: '1' } }, { data: { id: '1' } }]);
    await fobStm({ ...CREDS, api_key: 'orgA' }).accounts.get('1');
    await fobStm({ ...CREDS, api_key: 'orgB' }).accounts.get('1');
    expect(calls[0].init.headers['api-key']).toBe('orgA');
    expect(calls[1].init.headers['api-key']).toBe('orgB');
  });
});
