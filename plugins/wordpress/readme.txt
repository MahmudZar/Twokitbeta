=== TwoKit ===
Contributors: mahmudzar
Tags: bricks, design system, css framework, variables, typography
Requires at least: 6.2
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.26
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A design system for Bricks Builder: colors, surfaces, fluid type and spacing, and a small set of utility classes.

== Description ==

TwoKit builds a complete design system from a few choices: a brand color, surfaces, a type scale and a spacing scale. Light and dark themes come from the same tokens, through Bricks' own theme switch (no JavaScript on your site).

Choose where your styles live during setup:

* **Saved in Bricks**: variables, classes, color palette, theme style and fonts are written into Bricks. Bricks prints only the classes each page uses. You can uninstall TwoKit afterwards and the site stays styled.
* **TwoKit files**: variable values, the theme style's stylesheet and the utility classes live in two minified CSS files in your uploads folder, cached by the browser. Bricks keeps the TwoKit theme style with all its settings (site background, typography, section padding, container width…), your fonts (Bricks font library) and the variable, class and palette names its pickers need. Uninstalling TwoKit removes everything it added.

Switching between the two moves everything across: going to TwoKit files empties TwoKit's variable values, class CSS and theme style stylesheet in Bricks; going back to Saved in Bricks writes them into Bricks first and only then removes the files.

In the block editor TwoKit behaves like Bricks: Bricks loads its styles into the editor canvas so Bricks components look as on the site, and TwoKit's styles come along (in both modes). The canvas stays light, like the editor around it, and keeps the editor's own background. Nothing else in wp-admin is styled. TwoKit doesn't change Bricks' block editor settings.

TwoKit opens inside your WordPress dashboard.

Either way, TwoKit's classes are locked in Bricks so they are not edited by accident, and every font (uploaded or from Google Fonts) is stored in the Bricks font library. Your site never loads anything from Google.

Export (in the header) lets you download a TwoKit project file (.twokit.zip) to open on another site, in the web app or in Figma, or export the system as HTML & CSS, a Bricks global data zip, or a Figma package for the TwoKit Figma plugin.

== External services ==

The TwoKit admin page uses Google Fonts only when an administrator picks a Google font:

* Browsing the Google Fonts list shows each family's name in that font, loaded from https://fonts.googleapis.com and https://fonts.gstatic.com.
* Saving downloads the chosen styles once from https://fonts.gstatic.com, so they can be stored in the Bricks font library on your own site.

Requests contain the font family and styles. As with any web request, Google receives the visitor's IP address and browser details. This happens in the administrator's browser on the TwoKit page only; site visitors never contact Google.

Google Terms of Service: https://policies.google.com/terms
Google Privacy Policy: https://policies.google.com/privacy

TwoKit sends nothing else anywhere: no account, no license check, no tracking.

== Installation ==

1. Install and activate TwoKit.
2. Open **Bricks → TwoKit** in the admin menu (**Appearance → TwoKit** when Bricks isn't the active theme) and choose where your styles live.
3. Set up colors, fonts, typography and spacing, then Save (Ctrl/Cmd S).

Saved in Bricks needs Bricks 2.4 or newer as the active theme. TwoKit files work with any theme.

== Frequently Asked Questions ==

= Does my site load JavaScript from TwoKit? =

No. Light and dark modes use Bricks' theme switch (data-brx-theme and the Style manager). The only TwoKit script is the variable picker, and it loads in the Bricks builder only, for logged-in editors.

= How do I pick a TwoKit variable in Bricks? =

Right-click a value field that takes variables (padding, gap, font size, a color…), or click into it and press Alt+V. Hover a variable to see it on the canvas, click to use it. Escape clears the search, then closes. With Code2Bricks, the same works on a value in its CSS editors.

= Why does the block editor show Bricks colors or variables? =

Bricks 2.4 loads its color palette, variables, theme styles and component styles into the block editor so Bricks components look as on the site. TwoKit's styles come along. The canvas always uses the light theme (the editor around it is light) and the editor's own background, whatever your site's default mode or your computer's dark mode. To keep Bricks' theme styles out of the editor, use Bricks → Settings → General → "Disable Bricks theme styles in the block editor".

= Is TwoKit's theme mode the same as Bricks' Style manager mode? =

Yes. Theming → Default mode in TwoKit and the Style manager's default mode in Bricks are one setting. Saving TwoKit writes it to Bricks; a change made in Bricks shows in TwoKit when you open it or return to its tab. A change you made in TwoKit and haven't saved yet is kept until you save.

= How do I remove TwoKit but keep the plugin? =

TwoKit → Project → Remove TwoKit from this site. It deletes TwoKit's CSS files and everything TwoKit added to Bricks (variables, classes, palette, theme style, fonts), and the saved project. Bricks' own settings (builder and performance options, the Style manager default mode) are left as they are.

= What happens when I uninstall? =

Saved in Bricks: everything stays in Bricks and TwoKit's classes are unlocked. TwoKit files: the files and everything TwoKit added to Bricks are removed.

== Changelog ==

= 1.0.26 =
* The TwoKit theme style's Body and Headings fonts now fill Bricks' own "Fallback fonts" field with system fonts of the same kind (sans: ui-sans-serif, system-ui, sans-serif; serif: ui-serif, Georgia, serif; monospace: a monospace stack). If the font ever fails to load, pages fall back to a similar system font instead of the browser default (Times).

= 1.0.25 =
* Fix: fluid sizes that are smaller on desktop than on mobile (small spacing and text steps such as space-4xs and text-xs, or a section padding set larger on mobile) now scale with the screen. Their clamp() had the larger value first, so browsers always used the mobile size.
* Fix: projects that chose the animated link underline in an older TwoKit got a plain underline and --btn-link-underline: var(--animated), a variable that doesn't exist. They get the growing underline back and a real underline color.
* The light/dark theme values were written twice on every page (as variables and again in the theme stylesheet). They are now written once.
* The builder variable picker's script is versioned by file time, so browsers never keep an old copy.
* Tested up to WordPress 7.1.

= 1.0.24 =
* text-style-h1 … h4 now set the heading color (Typography → Heading color, var(--text-primary) by default), so a paragraph given an H1 style looks like an H1. Text color classes (text-muted, text-action …) placed next to one still win.

= 1.0.23 =
* Fix (TwoKit files mode): TwoKit classes now work in the Bricks builder exactly as on the site. In the builder Bricks writes the theme style after TwoKit's stylesheet, so a theme-style rule of the same weight won (a Div with grid-3 stayed flex). The builder canvas now loads TwoKit's two files after Bricks' CSS, like the site does.
* Bricks component thumbnails include TwoKit's styles in TwoKit files mode.

= 1.0.22 =
* Security: a project file (.twokit.zip, or a saved project) is checked before it is used. Palettes get a strict shape (safe names, #RRGGBB colors, a known Tailwind family) and their shades are always made again from the base color; every other value is checked for HTML and for anything that could end a CSS rule. A value that fails is dropped and TwoKit's default is used. A crafted "design kit" can no longer run code in the TwoKit page.
* Security: nothing that could break the page's CSS reaches Bricks. The app checks variable values, class names and CSS, the theme style and the palette before it builds the Bricks package, and WordPress checks what Bricks stored for TwoKit's items after every import (Bricks prints these values without escaping).
* Security: the TwoKit page in the dashboard runs only TwoKit's own script files (a Content-Security-Policy without inline scripts), so even injected markup could not run.
* Security: only Bricks' Builder and Performance settings are ever imported (never custom code or API keys).
* Fonts: a font that already exists in Bricks' font library and wasn't added by TwoKit is no longer replaced, and is never removed with TwoKit. TwoKit now remembers its own fonts by their id.
* Fonts: unchanged fonts are no longer sent to Bricks on every save, and the font files a save replaces are deleted. Before, every save added a full copy of every font file to the media library.
* Saves send the Bricks package as a file upload, so large font sets need much less memory on the server (very large packages on hosts with a small upload limit still go the old way).
* WordPress' own update notices stay visible on the TwoKit page.
* Uninstall on a multisite network only works on sites where TwoKit was used.
* The plugin no longer ships a 700 KB source map.

= 1.0.21 =
* New fixed shadow variables, like the light and dark surface colors: --light-shadow-1 … --light-shadow-8 and --dark-shadow-1 … --dark-shadow-8. They never switch, so a card can have the dark shadow anywhere: box-shadow: var(--dark-shadow-3). --shadow-1 … --shadow-8 still follow the theme (they now point to these), and so do the named shadows (shadow-card, shadow-raised …). Pages look the same as before.
* In Bricks the new variables are in Tk Shadows - light values and Tk Shadows - dark values. They are written on your next TwoKit save.
* Also in the HTML & CSS export (variables.css) and the closed-mode stylesheet.
* Variable picker: the shadow scale shows each level with a light and a dark button, like the color pairs, each with a small preview of that shadow. The level used as a named shadow is tagged (card, raised, popover, dialog).

= 1.0.20 =
* Variable picker, style panel: hovering and clicking work again. 1.0.19 hid hovers from Bricks' undo history, which made Bricks rebuild the style panel after every hover, so the field TwoKit wrote to was gone: nothing showed and a click did nothing. The picker now works exactly like Core Framework: hovering types the variable into the field and Bricks shows it, moving off types the old value back, a click keeps it.
* Variable picker, Code2Bricks: it never opens on the Styling panel CSS block or in a read-only CSS editor (locked class, component), even with a Code2Bricks version that does not check this itself.

= 1.0.19 =
* Variable picker, style panel: hovering a variable now types it into the field, so Bricks shows it on the canvas exactly as a click would (units, linked sides, breakpoints and states included). Hovers leave no undo step; moving off, Escape or closing puts the field back as it was (a palette color stays a palette color). A click is one normal change.
* Variable picker: no picker on the fields of a locked Bricks class. Right-click there opens the browser menu.

= 1.0.18 =
* Variable picker: it no longer closes when the builder canvas takes focus by itself (for example when Bricks redraws an element after a hover preview). A click in the canvas or switching to another window still closes it.

= 1.0.17 =
* Every TwoKit variable category in Bricks now starts with "Tk": Tk Base, Tk Brand - primary, Tk State - success, Tk Theme - tokens and so on, so your own categories and TwoKit's are easy to tell apart in Bricks' Variables manager. Variable names, class names and class categories are unchanged; nothing on your pages changes.
* The old categories (Base, Brand - primary …) are removed on the next save once they are empty, also when the variables came from a Bricks import made by hand. A category that still holds one of your own variables stays.
* Variable picker: the color groups come in this order everywhere: Palettes, States, Action, Surfaces, then Text, Borders and the rest. A field only opens the groups that fit it; a background field now also opens States (info-surface, success-surface …).

= 1.0.16 =
* Variable picker, Palettes: each palette shows its base color, then one strip with every step from lightest to darkest (50 to 950), the base step in its place. The separate "Shades of" and "Tints of" rows are gone. Same in the style panel and in Code2Bricks' CSS editor.

= 1.0.15 =
* The variable picker opens where your value is: if a field already uses a TwoKit variable (for example the background is `info-surface`), the picker opens that variable's group on the right tab (States → info), marks the variable and scrolls to it. Before, it always opened the groups that usually fit the field (Surfaces). Light and dark variants (`--dark-…`) find their color too.
* In Code2Bricks' CSS editor, the variable under the cursor is the one shown, so with several variables in one value (`padding: var(--space-s) var(--space-m)`) the picker shows the one you are on.

= 1.0.14 =
* Variable picker: hovering a variable now previews it on the canvas in Bricks' style panel fields too, through Bricks' own preview (nothing is saved until you click). A click goes through Bricks' own variable handling, so linked spacing sides, colors and nested controls get the value the same way as with Bricks' picker.
* Picking a variable inside a Bricks control popup (box-shadow, typography, border …) keeps the popup open; only you close it.
* Each field only lists what fits it: a color field shows colors, a size field shows sizes. A box-shadow's color field shows colors and its X, Y, blur and spread fields show sizes; whole shadow variables are left out there, because Bricks stores a shadow as separate parts. Use them in Code2Bricks' CSS editor (`box-shadow: var(--shadow-card)`).
* Palettes are the first group in the picker.
* The picker's scrollbar matches the builder: a thin rounded bar without a track.
* With Code2Bricks 1.7.1 builds from 2026-10-14 on: picking a color for `border` gives `1px solid` and the color, and on an existing border only the color changes.

= 1.0.13 =
* Variable picker in the Bricks builder: right-click a value field that takes variables (or press Alt+V in it) to pick a TwoKit variable. Variables are grouped like in TwoKit (surfaces, text, action, states, borders, palettes, spacing, type, layout, grid, radius, shadows and more); the groups that fit the field open first. Colors that have a light and a dark value offer the automatic variable and the fixed light or dark one. Hovering a variable previews it on the canvas; clicking writes var(--name) into the field. Search finds variables and groups (try "state" or "success surface").
* With Code2Bricks, the same picker works in its CSS editors (Alt+V or right-click on a value).
* The picker loads in the builder only; your site still gets no TwoKit JavaScript. Save once after updating so the picker has your variables.

= 1.0.12 =
* TwoKit moved into the Bricks menu (Bricks → TwoKit); it no longer adds a top-level item to the dashboard. Without Bricks it sits under Appearance. Old links keep working.
* Picking a color in the color picker, typing one, or pressing Generate now marks the project as unsaved right away (before, only once the picker closed, and never for Generate).
* Opening and closing the color picker without picking no longer marks the project as unsaved.

= 1.0.11 =
* full-bleed--padded works on its own (no full-bleed class needed). New full-bleed-left--padded and full-bleed-right--padded do the same for one side. The earlier combinations (full-bleed full-bleed--padded, full-bleed-right full-bleed--padded) still work.

= 1.0.10 =
* full-bleed--padded now means: the box reaches the window edge minus the section's inline padding on each side it bleeds (no padding inside the box). On phones it stays on the container line. full-bleed__content children line up with the container inside it.

= 1.0.9 =
* full-bleed full-bleed--padded straight in a section: the content now lines up with the container (it ran the full section width, so the class seemed to do nothing).
* full-bleed__content inside a full-bleed--padded box no longer steps in twice.

= 1.0.8 =
* full-bleed-left / full-bleed-right straight in a section (not in a column or container): the other side now starts on the container line instead of at the section padding. In columns nothing changes.

= 1.0.7 =
* New Padding classes: padding-{step}, padding-block-{step} and padding-inline-{step} for every fluid spacing step (padding-m) and, when fixed spacing is on, every fixed step (padding-16).
* New full-bleed__content class: on a direct child of a full-bleed, full-bleed-left or full-bleed-right box, the box reaches the window edge while the child stays within the container and lines up with the content around it.

= 1.0.6 =
* Fixed "This is not a TwoKit project" on save: the type scale was stored inside itself one level deeper on every change, until the project was too deeply nested for WordPress. Saved projects are repaired when they open.
* Switching storage mode: if the save fails, the mode button shows where the styles really are.

= 1.0.5 =
* Block editor: the canvas is white like WordPress' own (it showed the editor frame behind it, gray or dark). Bricks elements there keep Bricks' own colors.
* Block editor: the full-bleed clip and the theme-toggle rule are no longer repeated as bare rules on the canvas (Bricks' scoper dropped their :has() condition).
* After an update, TwoKit asks for one save, because the site's CSS is built at save time.

= 1.0.4 =
* Block editor: TwoKit leaves Bricks' block editor setting alone (1.0.3's change is undone) and loads like Bricks does, so Bricks components look right in both modes. The canvas stays light with the editor's own background, even in dark mode or with the auto theme.
* Theme mode follows Bricks: a Style manager default mode changed in Bricks shows in TwoKit, and Save won't overwrite it with an older value.
* Collapsed menu: hovering or focusing an icon shows its name.

= 1.0.3 =
* TwoKit files mode keeps the TwoKit theme style in Bricks with all its settings; only its stylesheet moves to twokit.css.
* The header Export button opens the Export screen, with a new TwoKit destination: the project file (.twokit.zip) for other TwoKit sites, the web app and Figma.
* Moving between screens no longer marks the project unsaved.

= 1.0.2 =
* Project files are one .twokit.zip (project.json plus uploaded fonts). Older .twokit.json files still open.
* Import opens a dialog: drop the file or browse.
* Project → Remove TwoKit from this site deletes everything TwoKit added and starts setup again.
* Security: explicit nonce check, request size limit, routes hidden from the REST index, framing and sniffing headers on the app page.

= 1.0.1 =
* TwoKit opens inside the dashboard; no back button, no dashboard-in-dashboard.
* The TwoKit mark is the menu icon.
* Storage mode button styled like Import / Export, with the TwoKit or Bricks logo.
* Surface screen shows the hierarchy only.
* Variables stay listed in Bricks in TwoKit files mode (names only).
* Gap classes for fluid and fixed spacing.
* App files are versioned per build, so updates are never hidden by the browser cache.

= 1.0.0 =
* First release.
