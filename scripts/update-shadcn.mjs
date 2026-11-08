/**
 * Refreshes the shadcn/ui components that ship in the "Web app (shadcn/ui)"
 * export: node scripts/update-shadcn.mjs
 *
 * Fetches the components below (and the components, hooks and helpers they
 * use) from the shadcn registry (style new-york-v4), rewrites their imports
 * for a normal project (@/lib/utils, @/components/ui/…, @/hooks/…), links
 * their state colors to TwoKit (see linkToTwoKit) and writes
 * app/assets/js/data/shadcnComponents.js with the npm packages they need,
 * pinned to today's versions. The export reads that file, so it works offline
 * and every export ships the same code.
 *
 * shadcn/ui is MIT licensed (c) 2023 shadcn.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STYLE = 'new-york-v4';
const BASE = `https://ui.shadcn.com/r/styles/${STYLE}/`;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'assets', 'js', 'data', 'shadcnComponents.js');

/** What a standard web app needs (the AI chat blocks and the old toast are left out). */
const WANT = [
    'accordion', 'alert', 'alert-dialog', 'aspect-ratio', 'avatar', 'badge', 'breadcrumb', 'button', 'button-group',
    'calendar', 'card', 'carousel', 'chart', 'checkbox', 'collapsible', 'combobox', 'command', 'context-menu', 'dialog',
    'drawer', 'dropdown-menu', 'empty', 'field', 'hover-card', 'input', 'input-group', 'input-otp', 'item', 'kbd',
    'label', 'menubar', 'native-select', 'navigation-menu', 'pagination', 'popover', 'progress', 'radio-group',
    'resizable', 'scroll-area', 'select', 'separator', 'sheet', 'sidebar', 'skeleton', 'slider', 'sonner', 'spinner',
    'switch', 'table', 'tabs', 'textarea', 'toggle', 'toggle-group', 'tooltip'
];

/** Where each kind of registry file goes in the project. */
const FOLDERS = { 'registry:ui': 'components/ui', 'registry:hook': 'hooks', 'registry:lib': 'lib' };

const items = new Map();

async function get(name) {
    if (items.has(name)) return;
    items.set(name, null);
    const response = await fetch(`${BASE}${name}.json`);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const item = await response.json();
    if (!FOLDERS[item.type]) throw new Error(`${name}: unexpected type ${item.type}`);
    items.set(name, item);
    for (const dep of item.registryDependencies || []) await get(dep.replace(/^.*\//, '').replace(/\.json$/, ''));
}

const rewriteImports = (code) => code
    .replace(/from "cn"/g, 'from "@/lib/utils"')
    .replace(/@\/registry\/[\w-]+\/ui\//g, '@/components/ui/')
    .replace(/@\/registry\/[\w-]+\/lib\//g, '@/lib/')
    .replace(/@\/registry\/[\w-]+\/hooks\//g, '@/hooks/');

/**
 * TwoKit state colors. shadcn colors states with one red: the solid for text,
 * see-through tints for surfaces (bg-destructive/10) and a dimmed solid in
 * dark mode (dark:bg-destructive/60), which washes TwoKit's reds out. TwoKit
 * has a token for each job, light and dark, so the classes point at those:
 *
 *   text-destructive(/90)      → text-error-text      (--error-text)
 *   bg-destructive/10, /20     → bg-error-surface     (--error-surface)
 *   dark:bg-destructive/60     → removed (the solid stays the solid)
 *   hover:bg-destructive/90    → hover:bg-destructive-hover (Buttons → Error hover)
 *   text-white (on destructive)→ text-destructive-foreground
 *   hover:bg-primary/90, bg-secondary/80 → their Buttons hover colors
 *   link variants              → text-link / hover:text-link-hover (Buttons → Link)
 *   shadows                    → TwoKit roles (see SHADOW_ROLE)
 *
 * Alert gets TwoKit's surface + border + text for destructive and new success,
 * warning and info variants; Badge gets success, warning and info.
 */
function utilityOf(token) {
    // The utility is after the last ':' that isn't inside [...]; a trailing '!' is important.
    let depth = 0;
    let cut = -1;
    for (let i = 0; i < token.length; i++) {
        if (token[i] === '[') depth++;
        else if (token[i] === ']') depth--;
        else if (token[i] === ':' && depth === 0) cut = i;
    }
    return { prefix: token.slice(0, cut + 1), utility: token.slice(cut + 1) };
}

/**
 * TwoKit shadow roles. shadcn sizes its shadows (shadow-md on menus, shadow-lg
 * on dialogs, shadow-sm on cards); TwoKit names them by role, so each surface
 * takes its role's alias and follows Theming → Shadows, light and dark.
 * Controls keep shadow-xs, which index.css maps onto TwoKit's scale.
 */
const SHADOW_ROLE = {
    dialog: 'dialog', 'alert-dialog': 'dialog', sheet: 'dialog', drawer: 'dialog',
    popover: 'popover', 'dropdown-menu': 'popover', 'context-menu': 'popover', menubar: 'popover', select: 'popover',
    combobox: 'popover', 'hover-card': 'popover', 'navigation-menu': 'popover', chart: 'popover',
    card: 'card', sidebar: 'card', tabs: 'raised', slider: 'raised'
};

function mapShadow(name, u) {
    const role = SHADOW_ROLE[name];
    if (!role) return null;
    if (['card', 'raised'].includes(role) ? u === 'shadow-sm' : ['shadow', 'shadow-md', 'shadow-lg', 'shadow-xl'].includes(u)) return `shadow-${role}`;
    return null;
}

function mapToken(token, name) {
    const { prefix, utility } = utilityOf(token);
    const bang = utility.endsWith('!') ? '!' : '';
    const u = bang ? utility.slice(0, -1) : utility;
    const out = (v) => (v === null ? null : `${prefix}${v}${bang}`);
    const shadow = mapShadow(name, u);
    if (shadow) return out(shadow);
    if (/^text-destructive(\/\d+)?$/.test(u)) return out('text-error-text');
    if (/^bg-destructive\/(5|10|15|20)$/.test(u)) return out('bg-error-surface');
    if (/^bg-destructive\/\d+$/.test(u) && /(^|:)dark:/.test(prefix) && !/hover|focus/.test(prefix)) return null;
    if (/^bg-destructive\/(80|90)$/.test(u)) return out('bg-destructive-hover');
    if (/^bg-primary\/(80|90)$/.test(u) && /hover/.test(prefix)) return out('bg-primary-hover');
    if (/^bg-secondary\/(80|90)$/.test(u) && /hover/.test(prefix)) return out('bg-secondary-hover');
    return token;
}

function linkToTwoKit(name, code) {
    let next = code.replace(/(?<=["'`\s])([^\s"'`]+)(?=["'`\s])/g, (token) => {
        if (!/destructive|primary\/|secondary\/|shadow/.test(token)) return token;
        const mapped = mapToken(token, name);
        return mapped === null ? '' : mapped;
    });
    // "bg-destructive text-white": white text on TwoKit's error button color.
    next = next.replace(/(["'`][^"'`]*bg-destructive[^"'`]*)\btext-white\b/g, '$1text-destructive-foreground');
    const must = (from, to) => {
        if (!next.includes(from)) throw new Error(`${name}: expected to find ${from}`);
        next = next.split(from).join(to);
    };
    if (name === 'button') must('link: "text-primary underline-offset-4 hover:underline"', 'link: "text-link underline-offset-4 hover:text-link-hover hover:underline"');
    if (name === 'badge') {
        must('link: "text-primary underline-offset-4 [a&]:hover:underline"', 'link: "text-link underline-offset-4 [a&]:hover:text-link-hover [a&]:hover:underline"');
        must('        outline:\n', [
            '        success: "bg-success text-success-foreground [a&]:hover:bg-success/90",',
            '        warning: "bg-warning text-warning-foreground [a&]:hover:bg-warning/90",',
            '        info: "bg-info text-info-foreground [a&]:hover:bg-info/90",',
            '        outline:\n'
        ].join('\n'));
    }
    if (name === 'alert') {
        must('"bg-card text-error-text *:data-[slot=alert-description]:text-error-text [&>svg]:text-current"', [
            '"border-error-border bg-error-surface text-error-text *:data-[slot=alert-description]:text-error-text [&>svg]:text-current",',
            '        success:',
            '          "border-success-border bg-success-surface text-success-text *:data-[slot=alert-description]:text-success-text [&>svg]:text-current",',
            '        warning:',
            '          "border-warning-border bg-warning-surface text-warning-text *:data-[slot=alert-description]:text-warning-text [&>svg]:text-current",',
            '        info:',
            '          "border-info-border bg-info-surface text-info-text *:data-[slot=alert-description]:text-info-text [&>svg]:text-current"'
        ].join('\n'));
    }
    // Removed classes leave double spaces inside class strings.
    next = next.replace(/"[^"\n]*"/g, (s) => s.replace(/ {2,}/g, ' ').replace(/^" /, '"').replace(/ "$/, '"'));
    const left = [...new Set(next.match(/[^\s"'`]*(?:destructive\/(?:[5-9]\d)|text-white)[^\s"'`]*/g) || [])];
    if (left.length) console.warn(`  ${name}: left as is: ${left.join(' ')}`);
    return next;
}

for (const name of WANT) await get(name);

const files = {};
const components = [];
const imports = new Set();
const registryVersions = {};
for (const [name, item] of [...items].sort(([a], [b]) => a.localeCompare(b))) {
    for (const dep of item.dependencies || []) {
        const m = /^(@?[^@]+)(?:@(.+))?$/.exec(dep);
        if (m && m[2] && m[2] !== 'latest') registryVersions[m[1]] = m[2];
    }
    if (item.type === 'registry:ui') components.push(name);
    for (const file of item.files) {
        const code = linkToTwoKit(name, rewriteImports(file.content));
        const left = code.match(/from "@\/registry[^"]*"/);
        if (left) throw new Error(`${name}: import not rewritten: ${left[0]}`);
        files[`${FOLDERS[file.type || item.type] || FOLDERS[item.type]}/${path.basename(file.path)}`] = code;
        for (const m of code.matchAll(/from "([^".][^"]*)"/g)) {
            const spec = m[1];
            if (spec.startsWith('@/') || spec === 'react' || spec === 'react-dom') continue;
            imports.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
        }
    }
}

// Pin every package: the registry's version when it names one, else today's latest.
const packages = {};
for (const name of [...imports].sort()) {
    if (registryVersions[name]) {
        packages[name] = /^[\d^~]/.test(registryVersions[name]) && !registryVersions[name].startsWith('^') ? `^${registryVersions[name]}` : registryVersions[name];
        continue;
    }
    const r = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`);
    if (!r.ok) throw new Error(`npm ${name}: HTTP ${r.status}`);
    packages[name] = `^${(await r.json()).version}`;
}

const date = new Date().toISOString().slice(0, 10);
const out = `/* Generated by scripts/update-shadcn.mjs on ${date}. Do not edit by hand.
   shadcn/ui components, style ${STYLE}, from the shadcn registry, with their
   state colors linked to TwoKit's tokens (see linkToTwoKit in the script).
   shadcn/ui: MIT License, Copyright (c) 2023 shadcn. https://github.com/shadcn-ui/ui */

export const SHADCN_STYLE = ${JSON.stringify(STYLE)};

/** npm packages the components import (besides react), pinned. */
export const SHADCN_PACKAGES = ${JSON.stringify(packages, null, 1)};

/** Component names (src/components/ui/<name>.tsx). */
export const SHADCN_COMPONENTS = ${JSON.stringify(components)};

/** Every file, by its path under src/. */
export const SHADCN_FILES = ${JSON.stringify(files, null, 1)};
`;
fs.writeFileSync(OUT, out);
console.log(`${components.length} components, ${Object.keys(files).length} files\npackages: ${Object.entries(packages).map(([k, v]) => `${k}@${v}`).join(', ')}\n→ ${OUT} (${Math.round(out.length / 1024)} KB)`);
