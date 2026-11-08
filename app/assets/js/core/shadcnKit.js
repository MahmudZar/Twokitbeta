/**
 * Web app kit: a React + Tailwind CSS v4 + shadcn/ui starter whose components
 * are linked to the TwoKit tokens (web app only; the plugins don't offer it).
 *
 * shadcn's components use Tailwind utilities (bg-primary, border-input,
 * rounded-md, shadow-md…). Those come from `@theme inline`, so the kit points
 * them straight at TwoKit tokens there (--color-primary →
 * var(--btn-primary-bg)). shadcn's own runtime names (--popover, --chart-1,
 * --sidebar-border…, read by a few components and charts) are set as aliases
 * too, except where TwoKit already has the name (--primary is a palette,
 * --border and --radius are TwoKit's): those keep TwoKit's value.
 *
 * The vendored components (data/shadcnComponents.js, see
 * scripts/update-shadcn.mjs) have their states and shadows linked as well:
 * state text/surface/border use TwoKit's error/success/warning/info tokens,
 * and each surface uses its TwoKit shadow role (card, raised, popover, dialog).
 *
 * Light and dark follow TwoKit's switch: light-dark() tokens + data-theme, and
 * Tailwind's dark: variant is redefined to match it. twokit.css ships in
 * public/ and is linked from index.html, outside the CSS build: Tailwind's
 * optimizer (Lightning CSS) rewrites light-dark() into a polyfill that
 * resolves where the token is declared (:root), so a nested data-theme
 * section would keep the page's colors.
 *
 * @module shadcnKit
 */

import { appTsx } from './shadcnKitApp.js';

/** Packages the starter itself needs (the components' own come pinned from data/shadcnComponents.js). */
const VERSIONS = {
    react: '^19.3.1',
    'react-dom': '^19.3.1',
    clsx: '^2.1.1',
    'tailwind-merge': '^3.7.0',
    'tw-animate-css': '^1.4.0',
    tailwindcss: '^4.3.5',
    '@tailwindcss/vite': '^4.3.5',
    vite: '^8.3.6',
    '@vitejs/plugin-react': '^6.2.1',
    typescript: '^5.9.3',
    '@types/react': '^19.3.0',
    '@types/react-dom': '^19.3.0',
    '@types/node': '^24.10.1'
};

/**
 * shadcn color → TwoKit token. One list builds the CSS and the README table.
 * Button colors and their hovers come from Styling → Buttons, so a shadcn
 * Button looks like a TwoKit button.
 */
export const SHADCN_COLORS = [
    ['background', 'site-bg', 'Page background'],
    ['foreground', 'text-primary', 'Body text'],
    ['card', 'surface-card', 'Card'],
    ['card-foreground', 'text-primary', ''],
    ['popover', 'surface-popover', 'Popover, menus, select, toasts'],
    ['popover-foreground', 'text-primary', ''],
    ['primary', 'btn-primary-bg', 'Default button, checked controls'],
    ['primary-foreground', 'btn-primary-text', ''],
    ['primary-hover', 'btn-primary-bg-hover', 'Default button hover'],
    ['secondary', 'btn-secondary-bg', 'Secondary button'],
    ['secondary-foreground', 'btn-secondary-text', ''],
    ['secondary-hover', 'btn-secondary-bg-hover', 'Secondary button hover'],
    ['muted', 'surface-raised', 'Tabs list, skeleton, table rows'],
    ['muted-foreground', 'text-muted', 'Descriptions, placeholders'],
    ['accent', 'hover', 'Hover and focus in menus, ghost buttons'],
    ['accent-foreground', 'text-primary', ''],
    ['destructive', 'btn-error-bg', 'Destructive button, invalid fields'],
    ['destructive-foreground', 'btn-error-text', ''],
    ['destructive-hover', 'btn-error-bg-hover', 'Destructive button hover'],
    ['link', 'btn-link-text', 'Link button and badge'],
    ['link-hover', 'btn-link-text-hover', ''],
    ['border', 'border', 'Borders'],
    ['input', 'border-strong', 'Field borders'],
    ['ring', 'focus-color', 'Focus ring'],
    ['chart-1', 'primary-500', 'Charts'],
    ['chart-2', 'info-solid', ''],
    ['chart-3', 'success-solid', ''],
    ['chart-4', 'warning-solid', ''],
    ['chart-5', 'error-solid', ''],
    ['sidebar', 'surface-1', 'Sidebar'],
    ['sidebar-foreground', 'text-primary', ''],
    ['sidebar-primary', 'action', ''],
    ['sidebar-primary-foreground', 'on-action', ''],
    ['sidebar-accent', 'hover', ''],
    ['sidebar-accent-foreground', 'text-primary', ''],
    ['sidebar-border', 'border', ''],
    ['sidebar-ring', 'focus-color', '']
];

/** Tailwind shadow names → TwoKit shadows: the role aliases, and the size scale onto TwoKit's 1–8. */
export const SHADCN_SHADOWS = [
    ['card', 'shadow-card', 'Card, floating sidebar'],
    ['raised', 'shadow-raised', 'Active tab, slider thumb'],
    ['popover', 'shadow-popover', 'Popover, menus, select, hover card, combobox, chart tooltip, toasts'],
    ['dialog', 'shadow-dialog', 'Dialog, alert dialog, sheet'],
    ['xs', 'shadow-1', 'Inputs, buttons, checkboxes (shadcn\'s control shadow)'],
    ['sm', 'shadow-2', ''],
    ['md', 'shadow-4', ''],
    ['lg', 'shadow-5', ''],
    ['xl', 'shadow-6', ''],
    ['2xl', 'shadow-7', '']
];

/** Tailwind radius names → TwoKit radius scale (xs and xl share their names). */
const RADII = [['sm', 'radius-s'], ['md', 'radius-m'], ['lg', 'radius-l'], ['2xl', 'radius-xxl']];

const STATES = ['info', 'success', 'warning', 'error'];
const SURFACES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', 'canvas', 'page', 'card', 'raised', 'popover', 'dialog'];

/** Tailwind's dark: variant, matched to where TwoKit turns dark. */
function darkVariant(mode) {
    const dark = '&:where([data-theme="dark"], [data-theme="dark"] *) { @slot; }';
    const notLight = '&:where(:not([data-theme="light"], [data-theme="light"] *)) { @slot; }';
    if (mode === 'dark') return `@custom-variant dark {\n  ${notLight}\n}`;
    if (mode === 'auto') return `@custom-variant dark {\n  ${dark}\n  @media (prefers-color-scheme: dark) {\n    ${notLight}\n  }\n}`;
    return `@custom-variant dark {\n  ${dark}\n}`;
}

/** Every custom property twokit.css defines. */
const definedIn = (css) => new Set([...css.matchAll(/(?:^|[\s;{])--([\w-]+)\s*:/g)].map((m) => m[1]));

/** src/index.css: Tailwind and the links from shadcn/Tailwind names to TwoKit tokens. */
export function indexCss({ name, mode, palettes, headings, twokitNames }) {
    const line = (k, v) => `  --${k}: var(--${v});`;
    const colors = SHADCN_COLORS.map(([k, v]) => line(`color-${k}`, v));
    const states = STATES.flatMap((s) => [
        line(`color-${s}`, `${s}-solid`),
        line(`color-${s}-foreground`, `${s}-on-solid`),
        line(`color-${s}-surface`, `${s}-surface`),
        line(`color-${s}-border`, `${s}-border`),
        line(`color-${s}-text`, `${s}-text`)
    ]);
    const surfaces = SURFACES.map((s) => line(`color-surface-${s}`, `surface-${s}`));
    const shades = palettes.flatMap((p) => p.shades.map((shade) => line(`color-${shade}`, shade)));
    // TwoKit's role aliases already have Tailwind's names (--shadow-card…); only the size scale needs a line.
    const shadowScale = SHADCN_SHADOWS.filter(([k, v]) => `shadow-${k}` !== v).map(([k, v]) => line(`shadow-${k}`, v));
    const shadowRoles = SHADCN_SHADOWS.filter(([k, v]) => `shadow-${k}` === v).map(([k]) => line(`shadow-${k}`, `shadow-${k}`));
    const runtime = SHADCN_COLORS.filter(([k]) => !twokitNames.has(k)).map(([k, v]) => line(k, v));
    const kept = SHADCN_COLORS.filter(([k]) => twokitNames.has(k)).map(([k]) => `--${k}`);
    const heading = headings.map((h) => `  ${h.tag} { font-size: var(--${h.token}); }`).join('\n');
    const sonner = STATES.map((s) => {
        const t = s === 'error' ? 'error' : s;
        return `  --${s}-bg: var(--tk-${t}-surface);\n  --${s}-border: var(--tk-${t}-border);\n  --${s}-text: var(--tk-${t}-text);`;
    }).join('\n');

    return `/* ${name} · web app theme, generated by TwoKit.
   shadcn/ui components read Tailwind's theme below, and every value points at a
   TwoKit token in public/twokit.css. Change the design in TwoKit, export again
   and replace public/twokit.css: the components follow.

   twokit.css is linked from index.html, not imported here: the CSS build would
   rewrite its light-dark() tokens, and nested data-theme sections would stop
   switching. */

@import "tailwindcss";
@import "tw-animate-css";

/* dark: utilities follow TwoKit's theme switch (data-theme="light|dark" on any element${mode === 'auto' ? ', else the OS' : ''}) */
${darkVariant(mode)}

@theme inline {
  /* shadcn/ui colors */
${colors.join('\n')}

  /* State colors: bg-success, text-warning-text, border-error-border… */
${states.join('\n')}

  /* Surfaces: bg-surface-2, bg-surface-card… */
${surfaces.join('\n')}

  /* Palettes: bg-primary-500, text-info-700… */
${shades.join('\n')}

  /* Shadows: TwoKit's roles (shadow-card, shadow-raised, shadow-popover, shadow-dialog)
     and shadcn's sizes on TwoKit's scale */
${shadowRoles.join('\n')}
${shadowScale.join('\n')}

  /* Radius: rounded-sm/md/lg/2xl (rounded-xs and rounded-xl use TwoKit's own) */
${RADII.map(([k, v]) => line(`radius-${k}`, v)).join('\n')}

  /* Fonts */
  --font-sans: var(--font-body);
}

/* shadcn's own names, for the few places that read them directly (toasts, sidebar,
   chart configs like color: "var(--chart-1)").${kept.length ? ` ${kept.join(', ')} stay TwoKit's.` : ''} */
:root {
${runtime.join('\n')}

  /* TwoKit state tokens under names the toaster doesn't overwrite */
${STATES.flatMap((s) => [`  --tk-${s}-surface: var(--${s}-surface);`, `  --tk-${s}-border: var(--${s}-border);`, `  --tk-${s}-text: var(--${s}-text);`]).join('\n')}
}

/* Toasts (sonner, <Toaster richColors />): TwoKit's state colors and popover shadow */
:root [data-sonner-toaster][data-sonner-theme] {
${sonner}
}
:root [data-sonner-toaster] [data-sonner-toast] {
  box-shadow: var(--shadow-popover);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    font-family: var(--font-body);
    line-height: var(--text-line-height);
  }
  :where(h1, h2, h3, h4, h5, h6) {
    font-family: var(--font-heading);
    line-height: var(--heading-line-height);
    text-wrap: balance;
  }
${heading}
}
`;
}

const README = ({ name, folder, fonts, components }) => `# ${name} · web app kit

A React + Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) starter, generated by TwoKit.
Every component is linked to your TwoKit design system: colors, state colors, surfaces,
shadows, radius, fonts and light/dark all come from \`public/twokit.css\`.

## Run it

\`\`\`bash
cd "${folder}"
npm install
npm run dev
\`\`\`

\`src/App.tsx\` is a small app (sidebar, header, pages) that uses every component; Ctrl/Cmd K
opens the search. Replace it with your app.

## What's inside

\`\`\`
public/twokit.css      your TwoKit tokens (same as variables.css in the HTML & CSS export), linked in index.html
src/index.css          Tailwind + the links from shadcn/Tailwind names to TwoKit tokens
src/components/ui/     ${components.length} shadcn/ui components
src/hooks/             hooks the components use
src/lib/utils.ts       cn() helper
components.json        shadcn CLI settings${fonts ? '\npublic/fonts.css      @font-face rules, files in public/fonts/' : ''}
\`\`\`

Components: ${components.join(', ')}.

## Update the design

Change it in TwoKit, export again and replace \`public/twokit.css\` (and \`src/index.css\` if you
added palettes). The components follow, nothing else to change.

## Light and dark

TwoKit switches with \`data-theme="light|dark"\` on \`<html>\` or on any element, and Tailwind's
\`dark:\` variant follows it. The kit uses next-themes with \`attribute="data-theme"\`.

## How the components are linked

| shadcn / Tailwind | TwoKit token | Used for |
|---|---|---|
${SHADCN_COLORS.map(([k, v, use]) => `| \`${k}\` | \`--${v}\` | ${use} |`).join('\n')}
${SHADCN_SHADOWS.map(([k, v, use]) => `| \`shadow-${k}\` | \`--${v}\` | ${use} |`).join('\n')}
| \`rounded-sm/md/lg/2xl\` | \`--radius-s/m/l/xxl\` | Radius |
| \`font-sans\` | \`--font-body\` | Body font; headings use \`--font-heading\` |

States: the bundled components use TwoKit's state tokens, not see-through tints of one red.
Alert has \`destructive\`, \`success\`, \`warning\` and \`info\` variants (surface, border and text
color of that state), Badge has \`success\`, \`warning\` and \`info\` too, error text uses
\`--error-text\`, and dark mode keeps the solid colors as TwoKit made them.

Extra utilities: \`bg-success\`, \`text-warning-text\`, \`bg-info-surface\`, \`border-error-border\`,
\`bg-surface-0…8\`, \`bg-surface-card\`, every palette shade (\`bg-primary-500\`), and
\`shadow-card\`, \`shadow-raised\`, \`shadow-popover\`, \`shadow-dialog\`.

## More components

\`\`\`bash
npx shadcn@latest add <name>
\`\`\`

They use the same theme: \`components.json\` points the CLI at \`src/index.css\`. Components added
this way come as shadcn writes them (one red for states, shadcn's shadow sizes, which are
mapped onto TwoKit's scale). If the CLI adds \`:root\` variables to \`src/index.css\`, delete the
ones this file already sets.

## Use it in an existing project

Copy \`public/twokit.css\` and link it in your page, \`src/index.css\` (or its \`@custom-variant\`,
\`@theme inline\`, \`:root\` and \`@layer base\` parts into your globals.css), \`src/lib/utils.ts\`,
\`src/hooks/\` and \`src/components/ui/\`, then install the packages in \`package.json\` → dependencies.

Keep \`twokit.css\` out of your CSS build (don't \`@import\` it into a Tailwind file): build tools
rewrite its \`light-dark()\` tokens, and then a \`data-theme\` section inside the page keeps the
page's colors. In Next.js put it in \`public/\` and add \`<link rel="stylesheet" href="/twokit.css" />\`
to the root layout's \`<head>\`.

shadcn/ui components: MIT License, Copyright (c) 2023 shadcn.
`;

/**
 * The kit as zip entries under `folder/`.
 * @param {object} o
 * @param {string} o.name        project name
 * @param {string} o.folder      folder name in the zip
 * @param {string} o.slug        npm package name
 * @param {string} o.variablesCss TwoKit's variables.css
 * @param {'light'|'dark'|'auto'} o.mode default theme
 * @param {{shades: string[]}[]} o.palettes palette shade token names
 * @param {{tag: string, token: string}[]} o.headings heading size tokens
 * @param {{fontsCss: string, files: {path: string, content: Uint8Array}[]}|null} o.fonts
 * @param {{files: Record<string,string>, components: string[], packages: Record<string,string>}} o.shadcn
 */
export function buildShadcnKit({ name, folder, slug, variablesCss, mode, palettes, headings, fonts, shadcn }) {
    const versions = { ...VERSIONS, ...shadcn.packages, 'next-themes': shadcn.packages['next-themes'] || '^0.4.6' };
    const pick = (list) => Object.fromEntries([...new Set(list)].sort().map((p) => [p, versions[p]]));
    const deps = ['react', 'react-dom', ...Object.keys(shadcn.packages), 'next-themes', 'clsx', 'tailwind-merge', 'tw-animate-css', 'tailwindcss', '@tailwindcss/vite'];
    const html = mode === 'auto' ? '' : ` data-theme="${mode === 'dark' ? 'dark' : 'light'}"`;
    const defaultTheme = mode === 'auto' ? 'system' : mode === 'dark' ? 'dark' : 'light';
    const { components } = shadcn;

    const files = [
        ['package.json', `${JSON.stringify({
            name: slug,
            private: true,
            version: '0.1.0',
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview', typecheck: 'tsc --noEmit' },
            dependencies: pick(deps),
            devDependencies: pick(['vite', '@vitejs/plugin-react', 'typescript', '@types/react', '@types/react-dom', '@types/node'])
        }, null, 2)}\n`],
        ['index.html', `<!doctype html>
<html lang="en"${html}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name.replace(/[<>&]/g, '')}</title>
${fonts ? '    <link rel="stylesheet" href="/fonts.css" />\n' : ''}    <!-- TwoKit tokens, as is (not through the CSS build: see src/index.css) -->
    <link rel="stylesheet" href="/twokit.css" />
    <script>
      // The saved theme before the first paint (no flash). "system" and none: TwoKit's default applies.
      try { var t = localStorage.getItem("theme"); if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); } catch (e) {}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`],
        ['vite.config.ts', `import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
})
`],
        ['tsconfig.json', `${JSON.stringify({
            compilerOptions: {
                target: 'ES2022',
                lib: ['ES2022', 'DOM', 'DOM.Iterable'],
                module: 'ESNext',
                moduleResolution: 'bundler',
                jsx: 'react-jsx',
                strict: true,
                skipLibCheck: true,
                noEmit: true,
                isolatedModules: true,
                resolveJsonModule: true,
                types: ['vite/client', 'node'],
                paths: { '@/*': ['./src/*'] }
            },
            include: ['src', 'vite.config.ts']
        }, null, 2)}\n`],
        ['components.json', `${JSON.stringify({
            $schema: 'https://ui.shadcn.com/schema.json',
            style: 'new-york',
            rsc: false,
            tsx: true,
            tailwind: { config: '', css: 'src/index.css', baseColor: 'neutral', cssVariables: true, prefix: '' },
            iconLibrary: 'lucide',
            aliases: { components: '@/components', utils: '@/lib/utils', ui: '@/components/ui', lib: '@/lib', hooks: '@/hooks' }
        }, null, 2)}\n`],
        ['.gitignore', 'node_modules\ndist\n*.log\n.DS_Store\n'],
        ['README.md', README({ name, folder, fonts: !!fonts, components })],
        ['src/main.tsx', `import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "next-themes"

import "./index.css"
import App from "./App"
import { TooltipProvider } from "@/components/ui/tooltip"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* TwoKit switches themes with data-theme */}
    <ThemeProvider attribute="data-theme" defaultTheme="${defaultTheme}" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>
)
`],
        ['src/App.tsx', appTsx(name)],
        ['src/index.css', indexCss({ name, mode, palettes, headings, twokitNames: definedIn(variablesCss) })],
        ['public/twokit.css', variablesCss],
        ['src/lib/utils.ts', `import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`],
        ...Object.entries(shadcn.files).map(([path, code]) => [`src/${path}`, code])
    ].map(([path, content]) => ({ path, content }));

    if (fonts) {
        files.push({ path: 'public/fonts.css', content: fonts.fontsCss });
        for (const f of fonts.files) files.push({ path: `public/fonts/${f.path}`, content: f.content });
    }
    return files.map((f) => ({ ...f, path: `${folder}/${f.path}` }));
}
