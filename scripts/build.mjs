/**
 * Builds the WordPress plugin and the Figma plugin from the web app.
 *
 *   npm run build            both
 *   npm run build wordpress  dist/wordpress/twokit/ + dist/twokit-wordpress-<v>.zip
 *   npm run build figma      dist/figma/twokit-figma/ + dist/twokit-figma-<v>.zip
 *                            (also copied to app/figma-plugin/ for the web app's
 *                            Export → Figma → Download plugin)
 *
 * dist/ keeps the latest zip of each plugin; older versions move to dist/archive/.
 *
 * One source: app/ (the web app, unbundled ES modules). The build bundles
 * app/assets/js/main.js and the stylesheets index.html links, minified, with
 * a source map that carries the original code (WordPress.org asks for readable
 * source). Host code lives in app/assets/js/hosts and plugins/.
 */

import { build, transform } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createZip } from '../app/assets/js/core/zip.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');
const DIST = path.join(ROOT, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['wordpress', 'figma'];

const read = (file) => fs.readFileSync(file, 'utf8');
const write = (file, content) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
};
const copy = (from, to) => fs.cpSync(from, to, { recursive: true });
const log = (msg) => console.log(`  ${msg}`);

/** Every file under a folder, as zip entries under `prefix/`. */
function entries(dir, prefix) {
    const out = [];
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const rel = `${prefix}/${name}`;
        if (fs.statSync(full).isDirectory()) out.push(...entries(full, rel));
        else out.push({ path: rel, content: new Uint8Array(fs.readFileSync(full)) });
    }
    return out;
}

/**
 * Writes a release zip. dist/ holds only the latest release of each plugin:
 * zips of other versions move to dist/archive/.
 */
function release(name, zipEntries) {
    const current = `twokit-${name}-${VERSION}.zip`;
    const archive = path.join(DIST, 'archive');
    for (const file of fs.readdirSync(DIST)) {
        if (file === current || !file.startsWith(`twokit-${name}-`) || !file.endsWith('.zip')) continue;
        fs.mkdirSync(archive, { recursive: true });
        fs.rmSync(path.join(archive, file), { force: true });
        fs.renameSync(path.join(DIST, file), path.join(archive, file));
    }
    const zipPath = path.join(DIST, current);
    fs.writeFileSync(zipPath, createZip(zipEntries));
    return zipPath;
}

/* ------------------------------------------------------------------ */
/* The app                                                             */
/* ------------------------------------------------------------------ */

const indexHtml = read(path.join(APP, 'index.html'));

/** The app bundle (IIFE: hosts load it as a classic script). */
async function bundleJs() {
    const result = await build({
        entryPoints: [path.join(APP, 'assets/js/main.js')],
        bundle: true,
        format: 'iife',
        target: 'es2020',
        minify: true,
        sourcemap: 'external',
        sourcesContent: true,
        legalComments: 'none',
        write: false,
        outfile: 'app.js',
        // Hosts always pass assetBase / inline files, so the import.meta fallbacks never run.
        define: { 'import.meta.url': '"about:blank"' },
        logLevel: 'warning'
    });
    const js = result.outputFiles.find((f) => f.path.endsWith('app.js')).text;
    const map = result.outputFiles.find((f) => f.path.endsWith('app.js.map')).text;
    return { js, map };
}

/** The stylesheets index.html links, in order, as one minified file. */
async function bundleCss() {
    const hrefs = [...indexHtml.matchAll(/<link rel="stylesheet" href="(assets\/[^"]+)">/g)].map((m) => m[1]);
    const css = hrefs.map((href) => read(path.join(APP, href))).join('\n');
    return (await transform(css, { loader: 'css', minify: true, target: 'chrome100' })).code;
}

/** The app's <body> markup (without the module script tag). */
function bodyMarkup() {
    const body = indexHtml.slice(indexHtml.indexOf('<body>') + 6, indexHtml.indexOf('</body>'));
    return body.replace(/\s*<script type="module"[^>]*><\/script>\s*/, '\n').trim();
}

/** Text that is safe inside an inline <script>. */
const inlineScript = (text) => text.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

/* ------------------------------------------------------------------ */
/* WordPress                                                           */
/* ------------------------------------------------------------------ */

async function wordpress(app) {
    const out = path.join(DIST, 'wordpress/twokit');
    // Empty the folder rather than delete it, so a running Playground mount keeps working.
    fs.mkdirSync(out, { recursive: true });
    for (const name of fs.readdirSync(out)) fs.rmSync(path.join(out, name), { recursive: true, force: true });
    copy(path.join(ROOT, 'plugins/wordpress'), out);

    const phpVersion = read(path.join(out, 'twokit.php')).match(/Version:\s+([\d.]+)/)?.[1];
    if (phpVersion !== VERSION) throw new Error(`twokit.php Version ${phpVersion} ≠ package.json ${VERSION}`);

    // No source map in the plugin (it would ship ~700 KB of readable source to every site).
    write(path.join(out, 'assets/app.js'), `${app.js}\n`);
    write(path.join(out, 'assets/app.css'), app.css);
    // Files the app loads at run time, at the paths it expects under assets/.
    for (const rel of ['logo.svg', 'img/export', 'js/data/google-fonts.json', 'js/core/woff2Worker.js', 'vendor/wawoff2', 'vendor/harfbuzz', 'vendor/README.md', 'vendor/core-framework-LICENSE.txt']) {
        copy(path.join(APP, 'assets', rel), path.join(out, 'assets', rel));
    }
    for (const dir of ['assets/img', 'assets/img/export', 'assets/js', 'assets/js/core', 'assets/js/data', 'assets/vendor', 'assets/vendor/wawoff2', 'assets/vendor/harfbuzz', 'views']) {
        write(path.join(out, dir, 'index.php'), '<?php\n// Silence is golden.\n');
    }

    const body = bodyMarkup().replace('src="assets/logo.svg"', 'src="<?php echo esc_url( TWOKIT_URL . \'assets/logo.svg\' ); ?>"');
    if (/<\?(?!php echo esc_url)/.test(body.replace(/<\?php echo esc_url\( TWOKIT_URL \. 'assets\/logo\.svg' \); \?>/, ''))) throw new Error('index.html body contains a PHP tag');
    write(path.join(out, 'views/app.php'), `<?php
/**
 * The TwoKit app document (TwoKit_Admin::render).
 * Generated by scripts/build.mjs from app/index.html. Do not edit.
 *
 * @package TwoKit
 */

defined( 'ABSPATH' ) || exit;
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?php echo esc_html__( 'TwoKit', 'twokit' ); ?></title>
<?php wp_print_styles( 'twokit-app' ); ?>
</head>
<body>
${body}
<?php wp_print_scripts( array( 'twokit-host', 'twokit-app' ) ); ?>
</body>
</html>
`);

    const zipPath = release('wordpress', entries(out, 'twokit'));
    log(`WordPress  dist/wordpress/twokit/  ·  ${path.relative(ROOT, zipPath)} (${Math.round(fs.statSync(zipPath).size / 1024)} KB)`);
}

/* ------------------------------------------------------------------ */
/* Figma                                                               */
/* ------------------------------------------------------------------ */

const dataUrl = (file) => {
    const ext = path.extname(file).slice(1);
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
    return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
};

async function figma(app) {
    const src = path.join(ROOT, 'plugins/figma');
    const out = path.join(DIST, 'figma/twokit-figma');
    fs.rmSync(path.join(DIST, 'figma'), { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });

    // Everything the app would fetch, embedded: the plugin iframe has no server to ask.
    const files = {
        inline: { 'js/data/google-fonts.json': JSON.parse(read(path.join(APP, 'assets/js/data/google-fonts.json'))) },
        assets: Object.fromEntries(fs.readdirSync(path.join(APP, 'assets/img/export')).map((name) => [`img/export/${name}`, dataUrl(path.join(APP, 'assets/img/export', name))]))
    };
    const body = bodyMarkup().replace('src="assets/logo.svg"', `src="${dataUrl(path.join(APP, 'assets/logo.svg'))}"`);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>TwoKit</title>
<style>${app.css}</style>
<script>window.TWOKIT_FIGMA_FILES = ${inlineScript(JSON.stringify(files))};</script>
<script>${inlineScript(read(path.join(src, 'host.js')))}</script>
</head>
<body>
${body}
<script>${inlineScript(app.js)}</script>
</body>
</html>
`;
    write(path.join(out, 'ui.html'), html);
    for (const name of ['manifest.json', 'code.js', 'README.md']) copy(path.join(src, name), path.join(out, name));

    const zipPath = release('figma', entries(out, 'twokit-figma'));
    // The web app's Export → Figma → Download plugin serves this folder.
    fs.rmSync(path.join(APP, 'figma-plugin'), { recursive: true, force: true });
    copy(out, path.join(APP, 'figma-plugin'));
    log(`Figma      dist/figma/twokit-figma/  ·  ${path.relative(ROOT, zipPath)} (${Math.round(fs.statSync(zipPath).size / 1024)} KB)  ·  app/figma-plugin/`);
}

/* ------------------------------------------------------------------ */

console.log(`TwoKit ${VERSION}`);
const [{ js, map }, css] = await Promise.all([bundleJs(), bundleCss()]);
log(`app.js ${Math.round(js.length / 1024)} KB  ·  app.css ${Math.round(css.length / 1024)} KB (minified)`);
const app = { js, map, css };
if (targets.includes('wordpress')) await wordpress(app);
if (targets.includes('figma')) await figma(app);
