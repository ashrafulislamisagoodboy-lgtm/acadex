import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newStudentRows, readFileUrl } from '../src/lib/imports.ts';

test('student imports skip existing and repeated IDs regardless of case', () => {
  const rows = [{ studentId: ' st-1 ' }, { studentId: ' ST-2 ', name: 'First' }, { studentId: 'st-2', name: 'Duplicate' }];
  assert.deepEqual(newStudentRows(rows, ['ST-1']), [{ studentId: 'ST-2', name: 'First' }]);
});

test('file reads return data or settle with a readable error', async t => {
  const original = globalThis.FileReader;
  t.after(() => original ? globalThis.FileReader = original : delete globalThis.FileReader);
  globalThis.FileReader = class {
    readAsDataURL(event) { this.result = 'data:text/plain;base64,YQ=='; this[event](); }
  };
  assert.equal(await readFileUrl('onload'), 'data:text/plain;base64,YQ==');
  await assert.rejects(readFileUrl('onerror'), /could not be read/);
  await assert.rejects(readFileUrl('onabort'), /cancelled/);
});
