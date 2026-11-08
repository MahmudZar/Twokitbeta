# TwoKit

A design-system generator: colors, surfaces, text colors, fluid type and spacing, and a small set of utility classes, from one place.

**Live app: [twokit.netlify.app](https://twokit.netlify.app/)**

One source, three products:

- **Web app** (`app/`): vanilla ES modules, no build step. Exports HTML & CSS, a Bricks package, a Figma package and a React + Tailwind + shadcn/ui starter whose components are linked to your tokens.
- **WordPress plugin** (`plugins/wordpress/`): the web app inside the dashboard, saving straight into Bricks (variables, classes, theme style, fonts in the Bricks font library), with a builder variable picker.
- **Figma plugin** (`plugins/figma/`): the web app inside Figma, with Apply to Figma (variables, text styles, effects).

## Run the web app

```bash
cd app
python -m http.server 5178
```

Then open http://localhost:5178.

## Build the plugins

```bash
npm install
npm run build
```

This writes `dist/wordpress/`, `dist/figma/` and a zip of each plugin. `npm run check:picker` checks the builder picker catalog. `node scripts/update-shadcn.mjs` refreshes the shadcn/ui components shipped in the web app kit.

## Repository

```
app/        the web app (also bundled into both plugins)
plugins/    WordPress (PHP) and Figma (sandbox + host) code
scripts/    build and checks
tests/      PHP tests (php-wasm) and manual browser checks
docs/       plugins-plan.md: architecture, security model, test steps
```

Netlify serves `app/` (see `netlify.toml`).

## License

GPL-2.0-or-later. The bundled shadcn/ui components (`app/assets/js/data/shadcnComponents.js`) are MIT, Copyright (c) 2023 shadcn.
