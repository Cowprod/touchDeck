import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export function createJsonStore(path) {
  let queue = Promise.resolve();
  async function load(fallback) {
    try { return JSON.parse(await readFile(path, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
  }
  function save(value) {
    const snapshot = JSON.stringify(value, null, 2) + '\n';
    const task = queue.catch(() => {}).then(async () => {
      await mkdir(dirname(path), { recursive: true });
      const temporary = join(dirname(path), '.' + randomUUID() + '.tmp');
      await writeFile(temporary, snapshot, { flag: 'wx', mode: 0o600 });
      await rename(temporary, path);
    });
    queue = task;
    return task;
  }
  return { load, save };
}
