// @ts-check
/**
 * Statements API transport.
 *
 * PURE: credentials come from the `credentials` argument, falling back to
 * FOB_STM_API_* env vars. This module never reads the CLI config file — that
 * resolution lives in src/config.js (a CLI concern), which passes resolved
 * credentials in as `credentials`. This is the layer workers import.
 *
 * Base URL is origin-only (e.g. https://statements.finopsbricks.com/); the
 * /api/v1 prefix is carried in the paths passed by the resource layer.
 */

/**
 * @typedef {import('./types/general/index.js').Credentials} Credentials
 * @typedef {import('./types/general/index.js').RequestOptions} RequestOptions
 * @typedef {import('./types/general/index.js').Transport} Transport
 */

/**
 * Row ceiling for auto-paginated fetches (`apiGetAll` / `ctx.getAll`). Exported
 * so the CLI can flag a truncated bulk result — `getAll` returns a plain array,
 * so `rows.length >= MAX_ALL_ROWS` is the signal that the cap was hit.
 */
export const MAX_ALL_ROWS = 15000;

export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, status?: number }} [opts]
   */
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * @param {Credentials} [credentials]
 * @returns {{ api_url: string, api_key: string, api_secret: string }}
 */
function resolveCreds(credentials) {
  const api_url = credentials?.api_url ?? process.env.FOB_STM_API_URL;
  const api_key = credentials?.api_key ?? process.env.FOB_STM_API_KEY;
  const api_secret = credentials?.api_secret ?? process.env.FOB_STM_API_SECRET;
  if (!api_url || !api_key || !api_secret) {
    throw new ApiError(
      'Missing statements credentials. Set FOB_STM_API_URL/API_KEY/API_SECRET, ' +
        'or pass a credentials override, or configure the CLI with `fob-stm config add <org>`.',
      { code: 'NO_CREDENTIALS' },
    );
  }
  return { api_url, api_key, api_secret };
}

function buildUrl(baseUrl, path, searchParams) {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const url = new URL(path.replace(/^\//, ''), base);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url;
}

/**
 * @param {string} method
 * @param {string} path
 * @param {any} [body]
 * @param {RequestOptions} [options]
 */
async function apiRequest(method, path, body, { credentials, searchParams } = {}) {
  const creds = resolveCreds(credentials);
  const url = buildUrl(creds.api_url, path, searchParams);

  const headers = {
    'api-key': creds.api_key,
    'api-secret': creds.api_secret,
    accept: 'application/json',
  };
  const init = { method, headers };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const text = await response.text();

  let respBody = null;
  if (text) {
    try {
      respBody = JSON.parse(text);
    } catch {
      throw new ApiError(
        `Invalid JSON response (status ${response.status}): ${text.slice(0, 200)}`,
        { code: 'INVALID_RESPONSE', status: response.status },
      );
    }
  }

  if (!response.ok) {
    const code = respBody?.error?.code || 'HTTP_ERROR';
    const message = respBody?.error?.message || `${response.status} ${response.statusText}`;
    throw new ApiError(message, { code, status: response.status });
  }

  return respBody;
}

export function apiGet(path, options) {
  return apiRequest('GET', path, undefined, options);
}

export function apiPost(path, body, options) {
  return apiRequest('POST', path, body ?? {}, options);
}

export function apiPut(path, body, options) {
  return apiRequest('PUT', path, body ?? {}, options);
}

export function apiPatch(path, body, options) {
  return apiRequest('PATCH', path, body ?? {}, options);
}

export function apiDelete(path, options) {
  return apiRequest('DELETE', path, undefined, options);
}

/**
 * Build the fully-resolved request URL (no credentials embedded). For commands
 * like `download --print-url` that show the URL the CLI would hit.
 * @param {string} path
 * @param {RequestOptions} [options]
 */
export function buildAuthedUrl(path, { credentials, searchParams } = {}) {
  const creds = resolveCreds(credentials);
  return buildUrl(creds.api_url, path, searchParams);
}

/**
 * POST a multipart/form-data body (file uploads). The FormData boundary is set
 * by fetch, so no content-type header is set. Unwraps the `{ data }` envelope.
 * @param {string} path
 * @param {FormData} formData
 * @param {{ credentials?: Credentials }} [options]
 */
export async function apiPostForm(path, formData, { credentials } = {}) {
  const creds = resolveCreds(credentials);
  const url = buildUrl(creds.api_url, path);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'api-key': creds.api_key, 'api-secret': creds.api_secret, accept: 'application/json' },
    body: formData,
  });

  const text = await response.text();
  let respBody = null;
  if (text) {
    try {
      respBody = JSON.parse(text);
    } catch {
      throw new ApiError(
        `Invalid JSON response (status ${response.status}): ${text.slice(0, 200)}`,
        { code: 'INVALID_RESPONSE', status: response.status },
      );
    }
  }
  if (!response.ok) {
    const code = respBody?.error?.code || 'HTTP_ERROR';
    const message = respBody?.error?.message || `${response.status} ${response.statusText}`;
    throw new ApiError(message, { code, status: response.status });
  }
  return respBody;
}

/**
 * GET a binary response with auth headers. Returns the raw Response + resolved
 * URL so the caller can inspect headers and stream the body. Throws ApiError on
 * non-2xx (parsing a JSON error envelope if present).
 * @param {string} path
 * @param {{ credentials?: Credentials }} [options]
 * @returns {Promise<{ response: Response, url: URL }>}
 */
export async function apiGetStream(path, { credentials } = {}) {
  const creds = resolveCreds(credentials);
  const url = buildUrl(creds.api_url, path);

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'api-key': creds.api_key, 'api-secret': creds.api_secret },
  });

  if (!response.ok) {
    const text = await response.text();
    let respBody = null;
    if (text) {
      try { respBody = JSON.parse(text); } catch { /* non-JSON error body */ }
    }
    const code = respBody?.error?.code || 'HTTP_ERROR';
    const message = respBody?.error?.message || `${response.status} ${response.statusText}`;
    throw new ApiError(message, { code, status: response.status });
  }
  return { response, url };
}

/**
 * Extract the filename from a Content-Disposition header (quoted, unquoted, or
 * RFC 5987 forms). Returns null if absent.
 */
export function parseContentDispositionFilename(header) {
  if (!header) return null;
  const enc = header.match(/filename\*=(?:UTF-8'')?([^;\r\n]+)/i);
  if (enc) {
    try { return decodeURIComponent(enc[1].trim()); } catch { /* fall through */ }
  }
  const quoted = header.match(/filename="((?:[^"\\]|\\.)*)"/i);
  if (quoted) return quoted[1].replace(/\\(.)/g, '$1');
  const bare = header.match(/filename=([^;\s]+)/i);
  if (bare) return bare[1];
  return null;
}

/**
 * Auto-paginating GET. Walks `page_context.has_more`, concatenating each page's
 * `data` array. Ignores `page`/`limit` in `searchParams` and fetches at the max
 * page size. Caps at `maxRows` and reports `truncated`.
 *
 * @returns {Promise<{ data: any[], page_context: object|null, truncated: boolean }>}
 */
export async function apiGetAll(path, options = {}, { maxRows = MAX_ALL_ROWS, pageSize = 500 } = {}) {
  const baseParams = { ...(options.searchParams ?? {}) };
  delete baseParams.page;
  delete baseParams.limit;

  const all = [];
  let page = 1;
  let pageContext = null;
  let truncated = false;

  while (true) {
    const result = await apiGet(path, {
      ...options,
      searchParams: { ...baseParams, page, limit: pageSize },
    });
    const rows = result?.data ?? [];
    pageContext = result?.page_context ?? null;

    if (all.length + rows.length > maxRows) {
      all.push(...rows.slice(0, maxRows - all.length));
      truncated = true;
      break;
    }
    all.push(...rows);

    if (!pageContext?.has_more) break;
    page++;
  }

  return { data: all, page_context: pageContext, truncated };
}

/**
 * Bind credentials once and return a transport whose methods no longer take a
 * `credentials` argument. This is the seam the resource layer builds on: the
 * `fobStm(credentials)` factory calls this, then hands the resulting `ctx` to
 * each `buildX(ctx)` so action files stay credential-free and pure.
 *
 * `credentials` may be undefined — the underlying transport then falls back to
 * FOB_STM_API_* env vars, so `fobStm()` with no arg works from a worker's env.
 *
 * @param {Credentials} [credentials]
 * @returns {Transport}
 */
export function createTransport(credentials) {
  return {
    get: (path, options) => apiGet(path, { ...options, credentials }),
    post: (path, body, options) => apiPost(path, body, { ...options, credentials }),
    put: (path, body, options) => apiPut(path, body, { ...options, credentials }),
    patch: (path, body, options) => apiPatch(path, body, { ...options, credentials }),
    delete: (path, options) => apiDelete(path, { ...options, credentials }),
    getAll: (path, options, pageOpts) => apiGetAll(path, { ...options, credentials }, pageOpts),
    postForm: (path, formData) => apiPostForm(path, formData, { credentials }),
    getStream: (path) => apiGetStream(path, { credentials }),
    buildUrl: (path, options) => buildAuthedUrl(path, { ...options, credentials }),
  };
}
