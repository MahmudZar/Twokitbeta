/**
 * Runs the PHP tests in this folder with PHP compiled to WebAssembly
 * (@php-wasm/node, the engine behind WordPress Playground): no PHP install
 * needed. Not a build dependency:
 *
 *   npm i --no-save @php-wasm/node@3.1.58 @php-wasm/universal@3.1.58
 *   node tests/php/run.mjs
 *
 * The project is mounted at /twokit; each *.test.php prints TK_TEST_OK or
 * TK_TEST_FAILED as its last line.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let loadNodeRuntime;
let PHP;
try {
  ({ loadNodeRuntime } = await import('@php-wasm/node'));
  ({ PHP } = await import('@php-wasm/universal'));
} catch (e) {
  console.log('Skipped: @php-wasm/node is not installed (see the comment at the top of tests/php/run.mjs).');
  process.exit(0);
}

const here = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const php = new PHP(await loadNodeRuntime('8.2', { emscriptenOptions: { processId: 1 } }));

const copy = (rel) => {
  const dest = `/twokit/${rel.replace(/\\/g, '/')}`;
  php.mkdir(path.posix.dirname(dest));
  php.writeFile(dest, fs.readFileSync(path.join(root, rel)));
};
for (const dir of ['plugins/wordpress/includes', 'tests/php']) {
  for (const file of fs.readdirSync(path.join(root, dir))) {
    if (file.endsWith('.php')) copy(path.join(dir, file));
  }
}

let failed = false;
for (const file of fs.readdirSync(here).filter((f) => f.endsWith('.test.php'))) {
  console.log(`\n${file}`);
  const result = await php.run({ scriptPath: `/twokit/tests/php/${file}` });
  const text = result.text + (result.errors || '');
  console.log(text.replace(/TK_TEST_(OK|FAILED)\s*$/, '').trimEnd());
  if (!/TK_TEST_OK\s*$/.test(text)) failed = true;
}
process.exit(failed ? 1 : 0);
