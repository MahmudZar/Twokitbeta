/**
 * Builds tests/manual/csp-smoke.html from the built plugin's app document
 * (dist/wordpress/twokit/views/app.php): PHP calls replaced with what
 * WordPress prints, plus the Content-Security-Policy TwoKit_Admin::app()
 * sends (as a meta tag). Run after `npm run build`, then open the page
 * through the "projects-harness" launch config and read window.cspViolations.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const php = fs.readFileSync(path.join(root, 'dist/wordpress/twokit/views/app.php'), 'utf8');
const assets = '../../dist/wordpress/twokit/assets/';
const data = {
  rest: '/nowhere/', nonce: 'x', mode: 'open', bricks: '2.4.3', canSave: true, project: '', bricksMode: '',
  adminUrl: '', pageUrl: '', assetBase: assets, version: 'test', built: 'test', fontsHash: '', maxUpload: 2097152
};

let html = php.replace(/^[\s\S]*?\?>/, ''); // header comment + defined( 'ABSPATH' )
html = html
  .replace("<?php wp_print_styles( 'twokit-app' ); ?>",
    `<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; object-src 'none'; base-uri 'self'">\n<script src="csp-smoke-listener.js"></script>\n<link rel="stylesheet" href="${assets}app.css">`)
  .replace(/<\?php wp_print_scripts\([^)]*\) \); \?>|<\?php wp_print_scripts\([^?]*\?>/,
    `<script type="application/json" id="twokit-wp-data">${JSON.stringify(data)}</script>\n<script src="${assets}host.js"></script>\n<script src="${assets}app.js"></script>`)
  .replace(/<\?php echo esc_url\( TWOKIT_URL \. '([^']+)' \); \?>/g, `../../dist/wordpress/twokit/$1`)
  .replace(/<\?php language_attributes\(\); \?>/, 'lang="en"')
  .replace(/<\?php bloginfo\( 'charset' \); \?>/, 'utf-8')
  .replace(/<\?php echo esc_html__\( '([^']+)', 'twokit' \); \?>/g, '$1');

if (/<\?php/.test(html)) {
  console.error('Unreplaced PHP left:', html.match(/<\?php[^?]*\?>/g).slice(0, 5));
  process.exit(1);
}
fs.writeFileSync(path.join(here, 'csp-smoke.html'), html);
console.log('wrote tests/manual/csp-smoke.html');
