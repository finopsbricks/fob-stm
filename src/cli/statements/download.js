import { createWriteStream, existsSync } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  apiGetStream,
  buildAuthedUrl,
  parseContentDispositionFilename,
} from '../../http.js';
import { requireCreds } from '../_helpers.js';
import { formatBytes } from '../../utils/format.js';

export async function downloadStatementHandler(argv) {
  const { id } = argv;
  const creds = requireCreds();
  const path = `/api/v1/statements/${encodeURIComponent(id)}/download`;

  if (argv.printUrl) {
    console.log(buildAuthedUrl(path, { credentials: creds }).toString());
    return;
  }

  const { response } = await apiGetStream(path, { credentials: creds });

  const headerFilename = parseContentDispositionFilename(
    response.headers.get('content-disposition'),
  );
  const filename = headerFilename || `statement-${id}`;
  const outputPath = argv.output ?? filename;

  if (existsSync(outputPath) && !argv.force) {
    throw new Error(
      `Refusing to overwrite existing file: ${outputPath}. Use --force to overwrite.`,
    );
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(outputPath));

  const len = response.headers.get('content-length');
  const size = len ? formatBytes(Number(len)) : '';
  console.error(`Wrote ${outputPath}${size ? ` (${size})` : ''}`);
}
