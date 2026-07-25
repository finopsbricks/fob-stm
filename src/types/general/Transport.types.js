/**
 * @typedef {import('./Credentials.types.js').Credentials} Credentials
 * @typedef {import('./Credentials.types.js').RequestOptions} RequestOptions
 */

/**
 * A credential-bound transport (see `http.js` `createTransport`). Every method
 * has the caller's credentials pre-applied, so the resource layer never threads
 * them.
 * @typedef {Object} Transport
 * @property {(path: string, options?: RequestOptions) => Promise<any>} get
 * @property {(path: string, body?: any, options?: RequestOptions) => Promise<any>} post
 * @property {(path: string, body?: any, options?: RequestOptions) => Promise<any>} put
 * @property {(path: string, body?: any, options?: RequestOptions) => Promise<any>} patch
 * @property {(path: string, options?: RequestOptions) => Promise<any>} delete
 * @property {(path: string, options?: RequestOptions, pageOpts?: { maxRows?: number, pageSize?: number }) => Promise<{ data: any[], page_context: object|null, truncated: boolean }>} getAll
 * @property {(path: string, formData: FormData) => Promise<any>} postForm
 * @property {(path: string) => Promise<{ response: Response, url: URL }>} getStream
 * @property {(path: string, options?: RequestOptions) => URL} buildUrl
 */

export {};
