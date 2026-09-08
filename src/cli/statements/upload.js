// @ts-check
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { basename, extname } from 'path';
import { clientFor } from '../_helpers.js';

const EXT_MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
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
      `Unsupported file type '${ext || file}'. Accepted: .pdf, .csv, .xls, .xlsx, .txt`,
    );
  }

  const stm = clientFor();

  const name = basename(file);
  const buffer = await readFile(file);

  const form = new FormData();
  form.append('file', new File([buffer], name, { type: mime }));
  if (argv.account) form.append('account_id', argv.account);
  if (argv.parserType) form.append('parser_type', argv.parserType);

  const d = await stm.statements.upload(form);

  if (argv.json) {
    console.log(JSON.stringify(d, null, 2));
    return;
  }

  console.log(`Uploaded '${name}' as statement ${d.id ?? '?'} (job ${d.job_id ?? '?'}, step '${d.step ?? 'read_file'}').`);
}
