# TwoKit for Figma

Imports a TwoKit design system into a Figma file: variables, text styles, shadows, color styles, with a font check.

## Install (once)

1. Unzip this folder somewhere permanent.
2. In the **Figma desktop app**: Plugins → Development → Import plugin from manifest…
3. Pick `manifest.json` from this folder.

Run it from Plugins → Development → TwoKit.

## Import

In TwoKit, open **Export** and take any of these:

- **Figma package** (`*.twokit-figma.json`)
- the **HTML & CSS style guide** zip (contains `figma/*.twokit-figma.json`)
- the **Bricks** zip (contains `twokit/*.twokit-figma.json`)

Drop it on the plugin. You get a review first (what is new, what updates, which fonts are missing), then Import.

## What you get

| Figma | From TwoKit |
| --- | --- |
| **Primitives** collection | Palette shades, `--primary`-style base aliases, radius (`radius/base` = `--radius`, the steps, `radius/button` = `--btn-radius`), fixed spacing |
| **Theme** collection · Light / Dark | Surfaces 0–8, text, borders, interaction, action, state colors, button colors, shadow colors, `site/background` (`--site-bg`). Aliases point at Primitives. |
| **Typography** collection · Desktop / Mobile | Font families, weights, every font size and its line height |
| **Spacing** collection · Desktop / Mobile | Fluid spacing steps, section padding, gutter, content widths, gaps, header height |
| **Text styles** | `Heading/H1…`, `Text/…`, `Body/…`, bound to Typography variables, with **vertical trim: cap height to baseline** |
| **Effect styles** | `Shadow/1…8`, each layer's color bound to a Theme variable |
| **Color styles** (optional) | `Theme/…`, bound to the Theme variables |

- **Fluid values**: Desktop is the value at TwoKit's max viewport, Mobile at its min viewport. Set a frame's Typography / Spacing mode to switch.
- **Shadows in both themes**: a dark shadow has extra inset highlight layers that light doesn't. Each style holds both themes' layers; each layer's color variable is transparent in the other mode, so `Shadow/2` is exact in Light and in Dark.
- **Line heights** are measured in the browser with the real font, because TwoKit's line heights are ex-based (they follow the font's x-height).
- **Code syntax**: every variable shows `var(--name)` in Dev Mode, matching the CSS.

Inverse tokens (inverse surface, text, border, action…) are not exported: on the web they flip one part of a page to the other theme, while a Figma frame simply uses the Light or Dark mode. Files that got them from an earlier version lose them on the next update with **Remove what's no longer in TwoKit** ticked.

## Updating

Once TwoKit has been applied to a file, the button reads **Update Figma** and turns green again when you change something. Update whenever the system changes. Everything is matched by name and updated in place, so layers that use the variables and styles keep working. Turn on **Remove what's no longer in TwoKit** to delete items the plugin made earlier that the new export no longer has. Your own variables and styles are never touched.

## Edge cases handled

- **Mode limits**: if your plan allows fewer modes than a collection needs, it is split into one collection per mode (`Theme · Light`, `Theme · Dark`), and styles are made per mode.
- **Missing fonts**: the nearest installed weight is used, or Inter when the family isn't installed. The review links to Google Fonts. Install the font, restart Figma, import again.
- **Unchecked collections**: aliases fall back to plain values, and styles fall back to fixed values.
- **Type changes**: if a variable changed type (e.g. number → color), the old one is renamed `(old …)` and a new one is made.
- **Zips**: stored or deflated (re-zipped by macOS or Windows) both work.
- **Wrong files**: a TwoKit project file, an old export or a Bricks zip without a package each get a clear message.
