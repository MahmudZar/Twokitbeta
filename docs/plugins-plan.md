# TwoKit plugins: WordPress (Bricks) and Figma

Status: **v1.0.0 built** (2026-10-03). This file is the plan and the implementation record; update it with every change.
The session log and working rules live in `CLAUDE.md`.

---

## 1. Decisions (from the user, 2026-10-03)

1. **The plugins are the web app.** Same UI, same screens, same previews (type preview next to the settings, etc.). No new screens, no extra panels, nothing the web app doesn't have. The big **Example** site preview is left out of both plugins.
2. **Write into Bricks whenever Bricks can hold it.** Variables, classes, color palette, theme style, fonts, Builder/Performance settings, Style manager default mode.
3. **Fonts are never hosted by TwoKit.** Google Fonts and uploads all go into the **Bricks font library** (custom fonts). Bricks' Google Fonts loading is always turned off.
4. **No JavaScript on the site.** Light/dark uses Bricks' own `data-brx-theme` and the Style manager default mode.
5. **No Figma ↔ WordPress connection.** Each plugin exports instead: HTML & CSS, Bricks global data zip, Figma package (the web app's Export screen, unchanged).
6. **WordPress setup is one screen**: choose *TwoKit files* (closed) or *Saved in Bricks* (open). Then straight into the app. The mode chip in the header reopens it to switch.
7. **Figma has no setup.** It mirrors the app, plus **Apply to Figma**.
8. **Minimal**: no fluff, no settings that aren't needed, no preview-only decorations.
9. **Closed-mode CSS is minified** (confirmed: `core/minifyCss.js`, applied before upload; PHP refuses anything with markup).
10. Icon sets: on hold.

## 2. Architecture

```
Twokit 2.0/
  app/                         the web app = the single source (unbundled ES modules)
    assets/js/platform.js      host detection: storage, asset URLs, hidden features
    assets/js/hosts/           wordpress.js (setup, Save), figma.js (Apply to Figma)
    assets/js/core/minifyCss.js
    assets/css/components/host.css
    figma-plugin/              BUILD OUTPUT (copy of dist/figma) for Export → Download plugin
  plugins/
    wordpress/                 PHP source of the WordPress plugin (slug: twokit)
    figma/                     code.js (sandbox: importer + storage), host.js, manifest.json
  scripts/build.mjs            npm run build [wordpress|figma]
  dist/                        build output + the latest zip of each plugin (not source)
    archive/                   zips of earlier versions (moved there by the build)
  docs/plugins-plan.md         this file
  CLAUDE.md                    working rules + session log
```

**Language/framework choice:** plain ES modules (the web app as it is) + PHP following WordPress Coding Standards. No React/Vite: the app already is the UI, one esbuild step bundles it. esbuild is the only dev dependency.

### Platform layer (`app/assets/js/platform.js`)

A host page sets `window.TWOKIT_HOST` before the bundle:

| Field | WordPress | Figma |
|---|---|---|
| `name` | `wordpress` | `figma` |
| `storage` | project in memory, seeded from the saved option; written only by Save | in memory, persisted by `code.js` in `figma.clientStorage` per file |
| `assetBase` | plugin `assets/` URL | (unused) |
| `inline` / `assets` | — | Google Fonts catalog + export images embedded |
| `hide` | `example`, `figma-plugin` | `example`, `font-upload`, `figma-plugin` |
| `defer` | — | `true`: start after the project arrives from the sandbox |

The web app never sets it: `localStorage`, `import.meta.url` paths, everything as before.

Changed app files: `platform.js` (new), `main.js` (host init, deferred start), `projectModule.js` (storage via Platform), `googleFonts.js` (catalog via `Platform.json`), `fontConverter.js` (worker URL via `Platform.asset`), `exportScreen.js` (logo URLs, hide Download plugin), `fontsModule.js` (hide Upload), `shell.js` (hide Example), `exportModule.js` (`bricksPackage` options `skipMissingFonts`, `cssInBricks`), `index.html` (host.css).

## 3. WordPress plugin

### Files

```
twokit/
  twokit.php                      header, constants, hooks
  uninstall.php                   mode-aware cleanup, per site on multisite
  readme.txt                      WordPress.org readme incl. External services (Google Fonts)
  includes/class-twokit-store.php     options: twokit_settings, twokit_project, twokit_bricks
  includes/class-twokit-files.php     closed mode files in uploads/twokit/ (fixed names, atomic, inline fallback)
  includes/class-twokit-bricks.php    Bricks importer call, locks, stale-item removal, Style manager, uninstall
  includes/class-twokit-rest.php      POST /twokit/v1/save (the only write path)
  includes/class-twokit-admin.php     Bricks submenu + full-screen app document
  includes/class-twokit-frontend.php  closed mode enqueue (front end in <head>; builder canvas at wp_footer, after Bricks' canvas styles; component thumbnails; block editor canvas via Bricks' own editor styles)
  includes/class-twokit-picker.php    builder variable picker: catalog check + storage (option twokit_picker), builder-only enqueue
  assets/picker/picker.js             the picker (vanilla, no build step): Bricks fields + Code2Bricks value-picker provider
  views/app.php                       GENERATED from app/index.html
  assets/host.js                      sets TWOKIT_HOST from TWOKIT_WP (printed by PHP)
  assets/app.js(+map), app.css        GENERATED bundle (minified; map carries the source)
  assets/js/core/woff2Worker.js, assets/vendor/{wawoff2,harfbuzz}   font upload conversion
  assets/js/data/google-fonts.json, assets/img/export/*, assets/logo.svg
```

### Modes

| | Closed · TwoKit files | Open · Saved in Bricks |
|---|---|---|
| Variables (+ categories) | values in `twokit-tokens.css`; Bricks keeps the **names with empty values** (listed in Bricks' variable picker, Bricks prints no CSS for an empty value) | Bricks variables |
| Theme style settings (typography, site background, links, section padding, container width, div) | **Bricks theme style**, same settings as open mode, stylesheet empty. Without Bricks: html/body/heading rules in `twokit.css` (`ExportModule.themeStyleCss`) | Bricks theme style |
| Theme style stylesheet (`themeStylesheet`) + utility classes | `twokit.css` | theme style CSS + each class's CSS |
| Classes in Bricks | names only, locked (class picker) | with CSS, locked |
| Palette (raw `var()` names), fonts (Bricks font library), Builder/Performance settings, Style manager mode | Bricks | Bricks |
| Frontend JS | none | none |
| Uninstall | removes files + every TwoKit item in Bricks (classes, variables, palette, theme style, fonts + their files) | keeps everything, unlocks TwoKit classes |

### Switching modes (nothing styled stays behind)

- **Open → closed**: write the files first (site styled by them from then on), then `strip_styles()` empties TwoKit's variable values, TwoKit's theme style stylesheet (settings stay) and every TwoKit class's CSS (direct option writes, works even without Bricks' importer; variable/theme-style ids are stable and re-sent by the app, so cleanup works even if tracking was lost), then import fonts + class names + palette.
- **Closed → open**: import into Bricks first; only on success switch the mode and delete the files. If Bricks refuses, the mode and the files stay as they were.

### Theme style font fallback (1.0.26)

- The Bricks theme style's `typographyBody` / `typographyHeadings` carry Bricks' own `fallback` field (the "Fallback fonts" input under Font family). Bricks writes `font-family: "Family", <fallback>` (assets.php, `$setting_value['fallback']`). Up to 1.0.25 it was the family alone, so a font that failed to load showed the browser default (Times).
- Value: `resolveRole().fallback` = `fontFallback(font)` in fontModel.js, the same category stack as the font variables (sans/display: `ui-sans-serif, system-ui, sans-serif`; serif: `ui-serif, Georgia, serif`; monospace; handwriting). Left out for a system stack role (its font-family is already the whole stack).
- `themeStyleCss()` (no Bricks) drops the `fallback` key: it uses the font variables, which already have the stack.

### Review fixes (1.0.25)

- **clamp() bounds smallest first** (`fluidScale.calculateClamp`, `LayoutCalculator.calculateClamp`). With max ratio > min ratio, steps below the base are smaller on desktop; `clamp(mobile, …, desktop)` then had min > max and browsers always used the mobile size (space-4xs/3xs/2xs, text-xs on the user's site). Same for a section padding set larger on mobile. Scales rebuild on load, so saved projects get it on the next save.
- **Legacy link underline**: projects from before `link.style` stored the style in `link.underline` (`animated`/`always`/`hover`). `applySnapshot` merged the app defaults (`style: 'underline'`) in first, so `withButtonDefaults` skipped the migration → `--btn-link-underline: var(--animated)` and a plain underline instead of the growing one. `migrateLink()` (buttonsCss.js) now runs on the saved link before the merge, and in `withButtonDefaults` it also repairs links already saved that way (`animated`/`always` are never color tokens; `hover` is a real token, so it's only a style when no style is stored).
- **Theme values written once**: `themeStylesheet()` no longer contains `ThemeTokens.fixedCss` / `tokenCss` (114 `--light-*`/`--dark-*` + 62 light-dark() tokens, identical to the Bricks variables). Bricks prints those variables on the site, in the canvas and in the block editor (`get_gutenberg_global_foundation_styles`); closed mode has them in twokit-tokens.css, which loads before twokit.css everywhere. The HTML & CSS export (`ThemeTokens.toCss`) is unchanged.
- Picker script versioned by `TwoKit_Admin::ver()` (version + filemtime, now public). readme: Tested up to 7.1.
- Checked, no change: the palette goes through Bricks' import on every Save like every other part; WordPress skips writing an identical option.

### Heading text styles carry the color (1.0.24)

- `text-style-h1…h4` (`core/utilityClasses.js`) also set `color`: Typography → Heading color (`t.headingColor`, default `var(--text-primary)`), the same value as the h1–h6 element rule (`htmlStyles.js`). A paragraph given `text-style-h1` now looks like an H1 everywhere: web app previews, HTML & CSS export, Bricks classes (open mode) and twokit.css (closed mode). Inside `surface-action`, `surface-{state}` and `theme-*` it follows, because those redefine `--text-primary`.
- The text color classes (`text-primary/secondary/muted/action/{state}`) are now emitted **after** the type classes, so `text-style-h4 text-muted` stays muted (same weight, later wins).
- Figma: no change. Figma text styles hold no fill, so the color stays on the layer (as before).

### Bricks builder canvas: same CSS order as the site (1.0.23)

- **The order is the contract.** On the site (inline or external CSS files) TwoKit's two files load after every Bricks stylesheet: frontend CSS, palette, variables, `theme-style-*.min.css`, post CSS. So a TwoKit class beats a theme-style rule of the same weight: `.grid-3 { display: grid }` over the theme style's `.brxe-div:where(:not(.brx-dropdown-content)) { display: flex }`.
- **The canvas is different.** The builder writes that same CSS as `<style id="bricks-inline-css-*">` tags (globalvars, colorvars, themestyles, globalclasses, page, rerender, preview-on-hover…) inside `div.brx-body`, i.e. after `<head>`. Up to 1.0.22 TwoKit's files were in `<head>`, so the theme style won: a Div with `grid-3` stayed flex in the builder and was a grid on the site (Blocks were fine: the theme style sets no display on `.brxe-block`).
- **Fix**: in the canvas (`bricks_is_builder_iframe()`) the files are printed at `wp_footer` priority 1 with `wp_styles()->do_items()`, after `div.brx-body`. Not as WordPress late styles: WordPress 6.9+ (`wp_load_classic_theme_block_styles_on_demand` → `wp_hoist_late_printed_styles`) moves late-enqueued styles back to the end of `<head>` on classic themes. The builder main window loads nothing (no site content). Element settings still win by specificity (`#brxe-…`), on the site and in the canvas alike.
- **Component thumbnails** (Bricks 2.4, `wp_ajax_bricks_get_component_preview_html`): Bricks links every queued stylesheet into the preview document, so TwoKit enqueues its files (URLs only) at priority 1 there. Bricks puts its own theme-style CSS after those links in that document, so a same-weight theme-style rule can still win in a thumbnail (thumbnails only).
- **Checked** (Playground, WordPress 7.1, Bricks 2.4.1, CSS loading = external files, closed mode, real TwoKit save): canvas `div.grid-3` flex → grid; TwoKit's links after `bricks-inline-css-footer`; computed styles of html, section, container, grid and its children equal on the site and in the canvas (only Bricks' canvas `<body>` and sub-pixel rounding differ). The canvas was loaded directly (`?bricks=run&brickspreview=1`, which Bricks serves without the license check); not run inside a licensed builder window, and component thumbnails not run.
- Note for tests: a theme-style file regenerated where Bricks' elements aren't registered yet (e.g. a plugin on `init` priority 10) has no element rules (`Theme_Styles::get_controls` skips `element-*` groups); a TwoKit save writes the full file.

### Block editor: like Bricks, light canvas

- Bricks 2.4 loads its frontend CSS, palette + variables, theme styles, Style manager CSS and component classes into the block editor canvas (`Admin::enqueue_block_editor_frontend_styles`, handle `bricks-frontend-gutenberg`, every rule rewritten by `Block_Editor::scope_css_for_gutenberg`: `:root`/`html…` → `.block-editor-iframe__html`, `body…` → `.block-editor-iframe__body`, anything else → `.block-editor-iframe__body <selector>`). Users can bring Bricks components into Gutenberg, so everything must be there.
- Open mode: TwoKit's styles are in Bricks and come along. Closed mode: `TwoKit_Frontend::block_editor()` (`enqueue_block_assets`, priority 20) appends both files' CSS to `bricks-frontend-gutenberg`, scoped by Bricks' scoper, only when Bricks enqueued that handle. Nothing else in wp-admin; nothing without Bricks.
- TwoKit never changes `disableThemeStylesInBlockEditor` (Bricks' default stays). 1.0.3 had set it to boolean `true`; `twokit_upgrade()` (admin_init, once per version) removes a boolean `true` only (Bricks' own form saves `'on'`).
- **The canvas stays light.** The bug: Bricks' scoper turns `html[data-brx-theme="dark"]` into plain `.block-editor-iframe__html` (the attribute is dropped), so the dark switch block always won and the canvas went dark next to the light editor. Now the Bricks switch uses `:root`, `:root[data-brx-theme=…]` (the scoper keeps the attribute; there is none in the editor, so light wins), and the auto block is `:root:not([data-brx-theme]):not(.block-editor-iframe__html)` (never matches in the editor).
- **The canvas is white like WordPress' own**: `.block-editor-iframe__html:not(.is-zoomed-out) { background-color: #fff }` in the theme stylesheet outranks the theme style's site background there (`.block-editor-iframe__html`, from the Bricks setting) and leaves WordPress' zoom-out frame alone. It must be a color: 1.0.4's `initial` left the iframe transparent (Bricks dequeues WordPress' `wp-reset-editor-styles` in the canvas and the theme style's site background sets `body { background: none }`), so the editor frame behind it showed through, gray or dark. Fonts, typography and components are unchanged.
- **Bricks' own colors in the canvas**: the `--bricks-*` → TwoKit map is `:root:not(.block-editor-iframe__html)`; the scoper turns it into `.block-editor-iframe__html:not(.block-editor-iframe__html)`, which never matches, so the editor keeps Bricks' defaults (site and builder get the map).
- **Scoper rule: never start a selector with `html…`**. `html(?:[^\s>+~]*)?` swallows everything attached to `html` (`html:has(.full-bleed)` became a bare `.block-editor-iframe__html`, three identical `overflow-x: clip` rules, and the theme-toggle rule switched transitions off for good). Use `:root…`; the scoper keeps what follows `:root`. (`overflow-x: clip` and the theme-toggle rule now use `:root:has(…)`.)
- **After a plugin update** the site keeps the CSS the previous app built until the next save. `twokit_settings.built` records the version of the last successful save; when it differs, the app marks the project unsaved and says "Save once to update your site's CSS".
- A failed switch (1.0.6): the app asks `POST /twokit/v1/status` (returns `mode` as well as `bricksMode`) and the mode button shows the mode WordPress really has; a closed save whose Bricks import fails has already written the files, so the site is on TwoKit files.
- Mode switches leave nothing behind (checked again for 1.0.5): open → closed empties TwoKit's variable values, theme style stylesheet and class CSS through option writes that trigger Bricks' file regeneration (`update_option_bricks_theme_styles`, `…_global_variables`, `save_global_classes_in_db`); closed → open deletes both files and the inline copy.
- For comparison: Core Framework (its Gutenberg add-on) and ACSS (Gutenberg module, off by default; "load styling in backend" on once enabled) load their CSS into the block editor only when their Gutenberg integration is switched on.

### Utility classes added in 1.0.7 (web app and both plugins)

- **Padding** group: `padding-{step}`, `padding-block-{step}`, `padding-inline-{step}` for the fluid steps and, when fixed spacing is on, the fixed steps (same steps as `gap-*`). Bricks category "TwoKit - Padding".
- **`full-bleed__content`**: on a direct child of `full-bleed` / `full-bleed-left` / `full-bleed-right`, the child gives the bleed (`--_bleed`) back on the bled side, so it lines up with the container while its parent reaches the window edge. Phones follow Layout → bleed on phones (keep / both / none). Works in block, flex and grid parents; in the block editor it's scoped under `.block-editor-iframe__body` like any class.

- **1.0.8, one-sided bleed straight in a section**: `full-bleed-left` / `-right` measure `--_keep` (how far the parent reaches past `--bleed-container`/`--content-width` on each side; 0 in a column or container). The kept side starts on the container line, the bled side reaches the window edge. Width plus both margins always equal the parent width, so a Bricks section's `align-items: center`, block flow and grid tracks place it identically.

- **1.0.10, `full-bleed--padded`** (meaning set by the user): the box reaches the window edge **minus the section's inline padding** on each side it bleeds; nothing is padded inside it. It shortens `--_bleed` to `max(0px, gutter - var(--sctn-inline-padding))`, so `full-bleed-left`/`-right` geometry, the phone options and `full-bleed__content` children follow; `full-bleed full-bleed--padded` is `100vw - 2 × padding` wide. On phones (gutter = section padding) it stays on the container line. (1.0.9 had read it as padding inside the box; replaced.)
- **1.0.11, standalone padded classes**: `full-bleed--padded` works alone (both sides); `full-bleed-left--padded` / `full-bleed-right--padded` are the one-sided versions (same geometry as `full-bleed-left`/`-right`, shorter bleed). The 1.0.10 combos (`full-bleed full-bleed--padded`, `full-bleed-right full-bleed--padded`) still work and measure identical. `full-bleed__content` works in all of them. The web app's HTML & CSS export ships the same utility CSS (`UtilitiesModule.css()` in styles.css) and the variables it reads (`--content-width`, `--sctn-inline-padding` in variables.css); checked to give pixel-identical results to the Bricks setup.
- **1.0.12, Bricks submenu, live changes mark unsaved**: menu moved into Bricks (see Dashboard). `AppState.notify('live')`: a change the screen painted itself, without a render. `RENDER_ON` in `ui/shell.js` doesn't list it, so nothing re-renders (the picker stays open, a typed field keeps its caret), but autosave and both hosts' unsaved markers (`section !== 'ui'`) hear it. Sent by `ColorPicker.onPick` (any `[data-color-swatch]`: brand/state palettes, surface hue), by a valid color typed in a palette's value field, and by Colors → Generate / spacebar (which never notified at all: not marked unsaved, not autosaved). `onPick` ignores a pick equal to the swatch's color (setting the picker's value on open fires `change`), and `commit` only sends `change` after a real pick, so open → close no longer marks the project unsaved. Checked in the web app with an `AppState` listener: open `[]`, close without pick `[]`, pick `['live']`, same pick again nothing, close `['colors']`. Not run in WordPress (no local PHP): the submenu, the Appearance fallback and the redirect.

### Builder variable picker (1.0.13, fixes in 1.0.14)

Design: Figma file "Code2Bricks wp plugin", section **TwoKit Variable Picker v3** (dark; light follows Bricks' builder variables). Header = search + close; one accordion per TwoKit category; plain mono chips; visuals only for colors (pairs; palettes: base bar, then one strip 50 → 950 with the base step in place (1.0.16, the user dropped the separate shades/tints rows)) and grids (column drawings); state colors and button variants as tabs.

- **Data**: `ExportModule.pickerCatalog(model)` → `core/pickerCatalog.js` builds a catalog from the same rows as the Bricks variables (so every name exists on the site): `{ v: 1, mode, groups: [{ id, label, sections }] }`, section types `pairs` (auto token + `--light-*`/`--dark-*`, swatches), `chips`, `grid` (column fractions), `palettes`, `tabs`, `shadows` (1.0.21: names only, `{ n, t? }`; the picker draws `shadow-N` + light/dark buttons for `--light-shadow-N` / `--dark-shadow-N` and reads their values from the canvas root with getComputedStyle, letting only plain shadow syntax into `style.boxShadow`; PHP accepts the type, no CSS stored). Categories TwoKit adds later fall into an "Other" group. Sent as `picker` in every save (a failure to build it never blocks a save). `npm run check:picker` checks it against the real ThemeTokens model.
- **PHP** (`TwoKit_Picker`): no REST route. `save()` checks the catalog field by field (enums, names `^[A-Za-z0-9_-]{1,80}$`, colors `#RRGGBB(AA)`, labels `sanitize_text_field`, caps: 40 groups, 12 sections, 400 items per section, 4000 items, 256 KB) and stores it in `twokit_picker` (not autoloaded); an invalid catalog keeps the previous one. `enqueue()` runs on `wp_enqueue_scripts` only when `bricks_is_builder_main()` and the user is logged in with `edit_posts`: never on the site, never in the canvas iframe. Data printed with `wp_json_encode` + `JSON_HEX_*`. Removed by reset and uninstall (`TwoKit_Store::delete_all`).
- **Picker** (`assets/picker/picker.js`): built on first open, group content rendered when a group opens and cached, search over a prebuilt index (synchronous; a few hundred names). Two capture listeners on the builder document (contextmenu, keydown); no MutationObserver, no polling. Renders with `textContent`/DOM only; colors re-checked before they reach a CSS custom property.
  - Triggers: right-click or Alt+V in a Bricks field inside `#bricks-panel` that takes variables (`.has-variables`, number and color controls). Other fields (CSS ID, text) keep the browser menu.
  - Context: the field's control key (for nested controls: Bricks' own `controlKey` / `parentKey` / `parentType` props, read from the field's component) → CSS property → groups listed first (`contextGroups`; Palettes leads every color list but stays closed when a more specific group fits: background → Surfaces; color → Text, Action, States; border-color → Borders; padding/margin → Spacing; gap → Gaps, Spacing; font-size, line-height, font-family, radius, shadows, grid, layout widths, transition, focus).
  - Search: terms match variable names, group names ("state", "shadow") and tab names ("success"); "succ surf" = success-surface. Tabs show their match counts. Matches highlighted.
  - Fit (1.0.14): a Bricks color field hides the groups without colors (spacing, layout, grid, type, radius, shadows, transition); a number/text field hides the color-only groups and Shadows. A Bricks box-shadow is stored as offsetX/offsetY/blur/spread + color (`assets.php` prints `box-shadow: [inset] X Y blur spread color`), so no field can hold a whole shadow variable: its color field gets `shadow-color` (Palettes, Text, Borders), its X/Y/blur/spread fields `shadow-offset` (Spacing). Whole shadows go in Code2Bricks' CSS editor. Palettes is the first group everywhere (sorted on load, so stored catalogs follow too).
  - Group order (1.0.17): `GROUP_ORDER` = Palettes, States, Action, Surfaces, Text, Borders, Interaction, Inverse, then the catalog's own order (sorted on load, so stored catalogs follow). Color groups keep that order in every field; only non-color fitting groups (Spacing, Shadows …) move to the top. Background fits Palettes, Surfaces, States.
  - Current value (1.0.15): the picker reads the `var()` names in the value (Code2Bricks also sends `target`, the part a pick replaces, i.e. the `var()` under the cursor). The first one TwoKit knows (`--light-x` / `--dark-x` count as x) opens its group instead of the context groups, on its tab (`state.tabs` key `${group}.${section}`), is marked `.is-current` and is scrolled into view with its group header (`revealCurrent`). Rendered groups are rebuilt on every open (`state.rendered` reset), otherwise a cached group kept the tab of an earlier open. Unknown variables fall back to the context groups.
  - Each variable has a kind (`color` from swatches/pairs/palettes/color-like names, `shadow`, `length`), sent to hosts as `opts.kind` with preview and apply (Code2Bricks builds `border: 1px solid <color>` with it).
  - Hover (1.0.20, exactly like Core Framework) = the variable is typed into the field (`input.value` + `input` event, the same as Core Framework's `setInput`) and Bricks renders it itself: units, linked spacing sides, color `{raw}`, breakpoints, states, canvas, and Code2Bricks' Style-panel CSS block. Bricks' controls emit on `input` (number control: `onInput`; text/color raw input: default trigger `["keyup"]` emits on input). Moving off / Escape / close types the field's old text back. Click types the variable with `input` + `change`. Bricks' own debounced history watcher (100/600 ms, diff of old vs new) merges hovers; a hover that is moved off leaves nothing. **Never set `$_state.historyInProgress`** from the picker: when it turns false Bricks replaces `activeClass` with a clone and calls `$_rerenderControls()`, so every control input is a new element (1.0.19 did, and hover + click stopped working in Bricks). Fields of a locked class (`$_state.activeClassIsLocked`, element panel) get no picker. The vnode walk from `.brx-body._vnode` (production Vue has no `__vueParentComponent`) is only used to read the field's control (property, color). Code2Bricks provider: `c2bReadOnly()` refuses to open when the asking editor (`.CodeMirror.c2b-value-picking`) is read-only or the cursor is in the Styling panel CSS block (Code2Bricks checks this too, from 1.7.2). Bricks' control popups close on any document `click`/`touchstart` outside them (`clickaway` directive), so the picker stops click, touchstart, mousedown, mouseup and keyup at its root: picking keeps the popup open. After an apply the field gets focus back only after Bricks has taken the value (60 ms), otherwise Bricks' own variable suggestions open on it; Bricks' `globalVariableSuggestions` is cleared after an apply. Shift-click applies and keeps the picker open. Escape clears the search, then closes. Outside clicks (also in the canvas iframe) close it.
- **Scrollbar** (Figma: `scrollbar` frame in v3): 6px column, 4px thumb, radius 2, `--builder-bg-4`, no track, 8px inset at both ends. `::-webkit-scrollbar` with `scrollbar-width/color: auto` on the body (an inherited `scrollbar-color` would switch Chrome to the standard scrollbar); Firefox gets `scrollbar-width: thin`.
- **Code2Bricks**: registers as a value picker through Code2Bricks' API version 1 (`window.code2bricksValuePickers.push(provider)`, works in either load order). Code2Bricks finds the declaration, previews through the same Bricks state, and only accepts `var(--name)` values from the picker. The picker root carries `data-c2b-focus-zone` so Code2Bricks' focus protection lets the search field keep focus. The picker mounts in the editor's own document (detached Code2Bricks windows).
- **Checked**: catalog script; in a browser harness with a stand-in for Bricks' state and canvas (`code2bricks/tests/manual/value-picker-harness.html`): Code2Bricks editor flow (preview, apply, undo, nested var(), Escape), Bricks fields (which fields, context groups, current value, outside click), search, light/dark, both load orders. **Not yet run in a live Bricks builder**: the Vue-component hover preview on Bricks fields, Bricks' handling of the input/change events on its color and number controls, and the PHP (no local PHP). 1.0.14: the preview and apply paths were traced through Bricks 2.4's builder source (`main.min.js`: `generatePreviewOnHoverCSS`, `control-variable-picker`, `addVariable`, `clickaway`); the user tests them by hand in Bricks.

### Variable categories: "Tk " prefix (1.0.17)

- In Bricks every variable category is `Tk <category>` (Tk Base, Tk Brand - primary, Tk State - success, Tk Theme - light values, Tk Theme - tokens, Tk Spacing - Fluid, Tk Font size …): `variableCategoryName()` in `ExportModule.bricksVariables()`. The web app (Export → Bricks zip and the single Bricks variables JSON) and the Figma plugin build the same package, so every Bricks export has the prefix (checked: `styles/variables/categories.json` in the web app zip). Only Bricks gets the prefix; CSS file comments, HTML & CSS export, Figma and the picker keep the plain names (`variableRows()`). Class categories stay `TwoKit - …`; no class or variable name changes. Category ids are `bricksId('cat:Tk …')`.
- Older categories: the app sends `legacyVariableCategories` (ids of the plain names, the same on every site). `TwoKit_Bricks::after_import()` removes those that no variable uses (`remove_empty_categories`), so a site imported by hand is cleaned too; tracked old categories go through the usual `remove_categories`. Export scopes saved with a plain name still match.

### A site's own items are never overwritten

Bricks' importer matches variables and classes by **name**. Before importing, `TwoKit_Bricks::skip_foreign()` drops any TwoKit variable/class whose name is already used by an item TwoKit didn't write (different id, not tracked), e.g. ACSS's `--radius` or a user's `.btn`. The save message lists what was left alone.

### Dashboard

Menu: TwoKit is a submenu of Bricks (`add_submenu_page( 'bricks', … )`, slug `twokit`, `manage_options`), like Code2Bricks: no top-level item, no icon. `admin_menu` runs at priority 99 because the Bricks menu (added by the theme at priority 10, only for `manage_options` users) must exist first; registered earlier, WordPress would name the page hook `admin_page_twokit` and refuse the page later. Without the Bricks menu (another theme; TwoKit files work with any theme) the page goes under Appearance (`themes.php?page=twokit`), and `admin.php?page=twokit` redirects there (done inside the `admin_menu` callback: WordPress rejects the unknown page right after that hook, before `admin_init`). `TwoKit_Admin::url()` is the one place that builds the address (iframe, Plugins screen link, `wp.pageUrl` for the app). No back-to-WordPress button (the menu is there); opening the iframe URL on its own redirects to the dashboard page. The storage-mode button is a regular header `.btn` (like Import/Export) with the TwoKit mark (TwoKit files) or the Bricks logo (Saved in Bricks).

The admin page keeps wp-admin's menu and admin bar; the app runs in an iframe (`admin.php?page=twokit&frame=1` renders only the app document), so CSS never leaks either way. Other plugins' notices are removed on this page. The iframe reports unsaved changes to the page (it asks before leaving) and the page forwards Ctrl/Cmd S into the iframe.

### Project files and reset (all three hosts)

- **Project file = `.twokit.zip`**: `project.json` + uploaded fonts as real files under `fonts/` (project.json's `fontFiles` maps face ids to paths). No base64 bloat; Google fonts are named, not shipped. Older `.twokit.json` (fonts as base64) still open.
- **Import** opens a dialog (drop or browse). Checks: file ≤ 80 MB, `project.json` ≤ 4 MB, schema `twokit/project`, zip read by `core/unzip.js` (≤ 400 entries, ≤ 25 MB per file, ≤ 80 MB total enforced while inflating, no encrypted entries, no `..`/absolute/backslash names, only `project.json` and `fonts/*.woff2|woff|ttf|otf` read), fonts must start with a real font signature.
- **Reset** depends on the host (`ProjectModule.resetWith`):
  - Web app: *Reset to defaults* (this browser).
  - WordPress: *Remove TwoKit from this site* → `POST /twokit/v1/reset` (confirm token): strips and removes every TwoKit item in Bricks (classes, categories, variables, palette, theme style, fonts + files), deletes the CSS files and TwoKit's options; setup starts again. Bricks' own settings and Style manager mode stay.
  - Figma: *Remove TwoKit from this file* → deletes every variable/style/collection TwoKit created (plugin data), the file's saved project, then closes the plugin (reopen = defaults).

### Theme mode = Bricks Style manager mode (two-way)

- TwoKit → Bricks: Save writes `bricks_style_manager.defaultMode` (`TwoKit_Bricks::default_mode`).
- Bricks → TwoKit: the app page opens with the project's `state.theme.defaultMode` replaced by Bricks' current mode (`TwoKit_Admin::project()`), and `wp.bricksMode` records it. Returning to the TwoKit tab (`visibilitychange`) calls `POST /twokit/v1/status` (read-only, same permission as save) and follows a change made in Bricks without marking the project unsaved, unless the mode was changed in TwoKit and not saved yet.
- Save sends `bricksMode`; if Bricks changed since and the app didn't, PHP keeps Bricks' mode (and patches the stored project), and returns `defaultMode` so the app shows it.
- Bricks always sets `data-brx-theme` on the site (inline head script), so the closed-mode CSS doesn't need regenerating when the mode changes in Bricks.

### Collapsed menu tooltips (all hosts)

`ui/navTooltip.js`: one fixed-position tooltip for the menu, shown only when an item's label is hidden (collapsed menu, or icon-only below 1100px, e.g. Figma's narrow window). Mouse: 350 ms delay, then instant between items; keyboard: on `:focus-visible`; Escape, click, scroll and resize hide it; hoverable; `aria-hidden` (the hidden label stays the accessible name). The collapse button's label and `aria-expanded` are synced on start too.

### Export (header button, all three hosts)

The header Export button opens the Export screen on the **TwoKit** destination (the project `.twokit.zip`: settings + uploaded fonts; opens in the web app, WordPress and Figma). The other destinations (Bricks, Figma, HTML & CSS) are in the same list. Web app Ctrl/Cmd S still downloads the project file; WordPress Ctrl/Cmd S saves.

### Save (`Ctrl/Cmd S` or the header button)

1. Browser builds: project snapshot; closed → both stylesheets, minified; with Bricks → the global-data zip (`ExportModule.bricksPackage`, same as Export → Bricks; Google fonts are downloaded as WOFF2 here).
2. `POST /wp-json/twokit/v1/save` with `X-WP-Nonce`.
3. PHP validates everything, stores the project, writes files (closed) or deletes them (open), calls `\Bricks\Unified_Global_Transfer::import_package_bytes( …, 'replace' )`, then: locks the classes, removes TwoKit classes/variables no longer in the project, sets `bricks_style_manager.defaultMode`, records ids in `twokit_bricks`.

### Security (researched; WordPress.org review checklist + common plugin CVEs)

- **Authorization**: two REST routes (save, reset), hidden from the REST index (`show_in_index: false`), bodies capped at 46 MB before decoding; `permission_callback` = `manage_options` **and** `edit_css` (core's Additional CSS capability; requires `unfiltered_html` on multisite). Never `__return_true`. Admin page checks `manage_options`.
- **CSRF**: the `wp_rest` nonce (`X-WP-Nonce`) is verified explicitly in the permission callback (like Core Framework), on top of WordPress' cookie authentication. Reset also needs a confirm token. No key-based or public routes (Core Framework has a key-based Figma route; TwoKit has none).
- **Admin page**: the app document sends `Content-Security-Policy: frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`; postMessage between page and iframe checks both origin and source window; opened on its own the app redirects into the dashboard.
- **Input**: JSON body only; mode/default mode enums; project ≤ 2 MB, valid JSON, `$schema` = `twokit/project`, depth ≤ 64; CSS ≤ 1 MB each, valid UTF-8, no NUL, no `<style`/`<script`/`<?`; zip ≤ 40 MB base64, strict base64, must start with `PK\x03\x04`; transfer types whitelisted; ids `^[A-Za-z0-9_:-]{1,64}$`; font names `sanitize_text_field`.
- **Files / path traversal**: TwoKit never unzips (Bricks' importer does, with Bricks' own permission checks per type). Written file names are constants; the folder gets `index.php`; writes go to `*.tmp` then move; only via `WP_Filesystem` direct, else inline fallback.
- **Output**: data for the app is printed with `wp_json_encode( JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT )`; URLs escaped; `noindex`; `nocache_headers()`.
- **Builder picker**: adds no route and no request; its catalog arrives with the (already authorized) save, is validated field by field, and is printed only into the builder's main window for logged-in users who can edit posts. It renders with textContent, and the only text it writes anywhere is `var(--name)` with a validated name.
- **Scope**: every Bricks change is limited to ids TwoKit recorded; user classes/variables/fonts are never touched. Class removal goes through `Helpers::save_global_classes_in_db` (bumps Bricks' timestamp so an open builder tab can't save stale classes back).
- **Standards**: `ABSPATH` / `WP_UNINSTALL_PLUGIN` guards, `twokit`/`TwoKit_` prefixes, text domain `twokit`, GPL-2.0-or-later, no external calls except documented Google Fonts in the admin browser, no tracking, no self-updater.

## 4. Figma plugin

- `ui.html` = the app bundle + CSS + `host.js` + embedded catalog/images, one file (Figma requires it). `networkAccess`: `fonts.googleapis.com`, `fonts.gstatic.com` only (font previews).
- `code.js` = the importer (variables with modes and aliases, text styles, shadows, optional color styles, mode-limit split, missing-font fallback, prune) + project storage: `figma.clientStorage`, keyed by a file id written once into the file, so autosaves never touch the document's undo history.
- **Apply to Figma**: build package → `inspect` → review modal (collections, counts, mode-limit split, missing fonts, color styles, remove stale) → `import` with progress → toast.
- **Update**: once applied, the file remembers it (`twokit-applied` plugin data); the button reads **Update Figma**, turns green after any change, and the review shows how many variables/styles are updated in place (all modes) vs new.
- **Not exported to Figma**: the inverse tokens (frames pick Light or Dark directly). Earlier imports drop them on an update with "Remove what TwoKit made earlier".
- Every text style gets **vertical trim: cap height to baseline** (`style.leadingTrim = 'CAP_HEIGHT'`; the live API takes the string, the docs' `{ type }` object is only a fallback). Applied on create and on every update.
- Variables match the CSS/Bricks names, including `--radius` (`radius/base`), `--btn-radius` (`radius/button`) and `--site-bg` (`site/background`, Light/Dark; alias of the chosen token, or the resolved color for custom CSS).
- Hidden: Example preview, font upload (Figma uses installed fonts), Download plugin.

## 5. Build

`npm install` once, then `npm run build` (or `build:wordpress`, `build:figma`):

- esbuild bundles `app/assets/js/main.js` (IIFE, minified, external source map with sources) and concatenates + minifies the stylesheets `app/index.html` links.
- WordPress → `dist/wordpress/twokit/` + `dist/twokit-wordpress-<version>.zip`. The version in `twokit.php` must equal `package.json` (build fails otherwise).
- Figma → `dist/figma/twokit-figma/` + `dist/twokit-figma-<version>.zip`, also copied to `app/figma-plugin/`.
- `dist/` holds only the latest zip of each plugin: the build moves zips of other versions to `dist/archive/` (`release()` in `scripts/build.mjs`; a single-target build only touches that target's zips).

### Test locally

- **WordPress**: `MSYS_NO_PATHCONV=1 npx @wp-playground/cli@latest server --port=9411 --mount-dir "<dist/wordpress/twokit>" /wordpress/wp-content/plugins/twokit --mount-dir "<External app/bricks.2.4.1/bricks>" /wordpress/wp-content/themes/bricks --blueprint <blueprint activating both> --login`, or upload the zip to any WordPress with Bricks 2.4+.
- **Figma**: Figma desktop → Plugins → Development → Import plugin from manifest → `dist/figma/twokit-figma/manifest.json`.

### Test results (2026-10-03, Playground + Bricks 2.4.1)

| Check | Result |
|---|---|
| Setup screen on first open, mode chip reopens it | ✓ |
| Open save: Bricks prints variables, Inter from Bricks font library, 0 Google requests, no TwoKit JS | ✓ |
| Closed save: `twokit-tokens.css` + `twokit.css` minified, versioned; TwoKit variables removed from Bricks | ✓ |
| Inline fallback when the folder can't be written (message names the reason) | ✓ |
| Closed uninstall: files, classes, fonts, font files and Bricks' cached @font-face removed | ✓ (fixed: attachments by parent + rule rebuild) |
| Open uninstall: site keeps variables and fonts | ✓ |
| Figma UI: starts after storage, Apply → review → import options → result toast; catalog/images embedded | ✓ (simulated sandbox) |
| Not yet: lock option values read back, multisite, PHPCS + Plugin Check, Figma desktop run | to do |

## 6. Release (to do)

GitHub tag → Actions: build, PHPCS (WordPress + PHPCompatibilityWP), Plugin Check, Playground smoke test, SVN deploy to WordPress.org, GitHub Release with both zips. Figma Community publishing is manual from Figma desktop.

## 7. Open items / known limits

- Uploaded font files live in the uploading browser (IndexedDB) until saved into Bricks; a save from another browser keeps Bricks' existing copy (`skipMissingFonts`) and says so.
- Very large saves (many fonts) can hit the host's `post_max_size`; the app shows "too large for this server".
- Figma file downloads (Export) rely on the plugin iframe allowing `<a download>` (works in Figma desktop).
- Bricks below 2.4: only TwoKit files mode works (no importer).
- Styles in the wp-admin aren't translatable yet (the app's UI text is English).

## Security model additions (1.0.22)

- **Project files are outside data.** `core/projectGuard.js` checks every snapshot before `applySnapshot()` uses it (also the project stored in WordPress or the browser): strict palettes with regenerated shades, every other string checked for markup and CSS break-outs, unknown keys dropped. Exports check again before Bricks (`bricksPackage()`), and WordPress checks what Bricks stored for TwoKit's own items after each import (`TwoKit_Bricks::scrub()`).
- **App document CSP.** `script-src 'self'` (+ the plugin's asset origin) `'unsafe-eval' 'wasm-unsafe-eval'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`. No inline scripts or handler attributes anywhere in the app: page data is a JSON block, sample links use `data-noop`. Any new inline handler in app markup will be blocked in WordPress: use delegated listeners.
- **Bricks settings.** Only the `builder` and `performance` tabs are passed to Bricks' importer.
- **Fonts.** TwoKit owns its fonts by post id (`twokit_bricks.fontPosts`); a same-named font of the site is never imported over or removed. Unchanged fonts (same `fontsHash`) are left out of saves; replaced files are deleted after an import.
- **Uploads.** Saves are multipart: the zip is a real uploaded file (never a path from the JSON); base64 JSON remains for zips larger than the PHP upload limit.
- **Tests.** `tests/php` runs TwoKit's PHP on PHP 8.2 in WebAssembly (`node tests/php/run.mjs` after `npm i --no-save @php-wasm/node@3.1.58 @php-wasm/universal@3.1.58`). `tests/manual/make-csp-smoke.mjs` builds a CSP test page from the built app document.
