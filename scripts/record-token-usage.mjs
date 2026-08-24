import { appendFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const raw = process.env.TOKEN_USAGE_JSON;
if (!raw) throw new Error('TOKEN_USAGE_JSON is required; estimates are not accepted');
const usage = JSON.parse(raw);
for (const field of ['date', 'time', 'task', 'provider', 'model', 'source']) {
  if (typeof usage[field] !== 'string' || usage[field].trim() === '') {
    throw new Error(`${field} is required`);
  }
}
for (const field of ['input_tokens', 'output_tokens']) {
  if (!Number.isSafeInteger(usage[field]) || usage[field] < 0) {
    throw new Error(`${field} must be an exact non-negative integer from usage metadata`);
  }
}
const total = usage.input_tokens + usage.output_tokens;
if (usage.total_tokens !== undefined && usage.total_tokens !== total) {
  throw new Error('total_tokens does not match input_tokens + output_tokens');
}
const unavailable = 'nicht verfügbar';
const fields = [
  usage.date,
  usage.time,
  usage.task,
  usage.provider,
  usage.model,
  usage.input_tokens,
  usage.output_tokens,
  total,
  usage.input_cost ?? unavailable,
  usage.output_cost ?? unavailable,
  usage.total_cost ?? unavailable,
  usage.currency ?? unavailable,
  usage.source,
];
const target = resolve('docs/token-usage/token-usage.csv');
await access(target);
const escaped = fields.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',');
await appendFile(target, `${escaped}\n`, 'utf8');
