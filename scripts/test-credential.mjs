import {readFile} from 'node:fs/promises';

// Manual live evaluations only. Never run these as part of CI.
export async function testCredential() {
  const file = process.env.FOLIO_API_KEY_FILE;
  if (!file) throw new Error('Set FOLIO_API_KEY_FILE to a local credential file before running a live evaluation.');
  const key = (await readFile(file, 'utf8')).match(/sk-[A-Za-z0-9_-]+/)?.[0];
  if (!key) throw new Error('No recognizable credential in the configured file.');
  return key;
}
