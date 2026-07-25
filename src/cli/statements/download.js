// @ts-check
import { createWriteStream, existsSync } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { parseContentDispositionFilename } from '../../http.js';
import { clientFor } from '../_helpers.js';
import { formatBytes } from '../../utils/format.js';

export async function downloadStatementHandler(argv) {
  const stm = clientFor();
  const { id } = argv;

  if (argv.printUrl) {
    console.log(stm.statements.downloadUrl(id).toString());
    return;
  }

  const { response } = await stm.statements.download(id);

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

  await pipeline(Readable.fromWeb(/** @type {any} */ (response.body)), createWriteStream(outputPath));

  const len = response.headers.get('content-length');
  const size = len ? formatBytes(Number(len)) : '';
  console.error(`Wrote ${outputPath}${size ? ` (${size})` : ''}`);
}
