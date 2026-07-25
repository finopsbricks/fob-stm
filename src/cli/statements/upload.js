import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { basename, extname } from 'path';
import { apiPostForm } from '../../http.js';
import { requireCreds } from '../_helpers.js';

const EXT_MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export async function uploadStatementHandler(argv) {
  const { file } = argv;

  if (!existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }

  const ext = extname(file).toLowerCase();
  const mime = EXT_MIME_TYPES[ext];
  if (!mime) {
    throw new Error(
      `Unsupported file type '${ext || file}'. Accepted: .pdf, .csv, .xls, .xlsx`,
    );
  }

  const creds = requireCreds();

  const name = basename(file);
  const buffer = await readFile(file);

  const form = new FormData();
  form.append('file', new File([buffer], name, { type: mime }));
  if (argv.account) form.append('account_id', argv.account);
  if (argv.parserType) form.append('parser_type', argv.parserType);

  const result = await apiPostForm('/api/v1/statements', form, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const d = result?.data ?? {};
  console.log(`Uploaded '${name}' as statement ${d.id ?? '?'} (job ${d.job_id ?? '?'}, step '${d.step ?? 'read_file'}').`);
}
