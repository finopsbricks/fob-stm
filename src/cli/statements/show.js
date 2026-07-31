// @ts-check
import { clientFor } from '../_helpers.js';
import { formatField, formatDate, formatAmount, formatBytes } from '../utils/format.js';
import { scaleMilliAmount } from '../utils/amounts.js';

export async function showStatementHandler(argv) {
  const stm = clientFor();
  const { id } = argv;
  const s = await stm.statements.get(id);

  if (argv.json) {
    const scaled = s
      ? { ...s, opening_balance: scaleMilliAmount(s.opening_balance), closing_balance: scaleMilliAmount(s.closing_balance) }
      : s;
    console.log(JSON.stringify(scaled, null, 2));
    return;
  }

  if (!s) {
    console.error(`No statement found for id: ${id}`);
    process.exit(1);
  }

  const w = 18;
  console.log(formatField('ID', s.id, w));
  console.log(formatField('File', s.file_name, w));
  console.log(formatField('Account', s.account_name ?? s.account, w));
  console.log(formatField('Currency', s.account_currency ?? 'INR', w));
  console.log(formatField('Period Start', s.period_start, w));
  console.log(formatField('Period End', s.period_end, w));
  console.log(formatField('Opening Balance', formatAmount(s.opening_balance), w));
  console.log(formatField('Closing Balance', formatAmount(s.closing_balance), w));
  if (s.file_size != null) console.log(formatField('File Size', formatBytes(s.file_size), w));
  console.log(formatField('Parser', s.parser_type, w));
  console.log(formatField('File Type', s.file_type, w));
  console.log(formatField('Archived', s.is_archived ? 'yes' : 'no', w));
  console.log(formatField('Created', formatDate(s.created_at), w));
  console.log('\n(use --json to include parsed_data / raw_data)');
}
