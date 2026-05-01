# App Icon — Creation and Implementation

## Design concept

MyDeck Console shares its visual identity with MyDeck Android: three overlapping
bookmark ribbons (cyan front, yellow middle, red-orange back) on a dark teal
rounded-square background. The Console variant adds a diagonal broken chain
(lower-left → upper-right) to signal the broken-bookmark repair purpose.

---

## Source material

| File | Location |
|---|---|
| Foreground layer (bookmarks only, transparent bg) | `../mydeck-android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp` |
| Full composited icon (with teal background) | `../mydeck-android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp` |
| Circular brand logo (used in Android About screen) | `../mydeck-android/app/src/main/res/drawable-xxxhdpi/ic_brand_logo.png` |

Use `ic_launcher_foreground.webp` as the AI input — transparent background gives
the most compositional flexibility.

---

## AI generation (ChatGPT / GPT-4o)

### Step 1 — Add the chain (transparent background)

Upload `ic_launcher_foreground.webp`. Prompt:

```
Modify the uploaded icon: add a small broken chain overlaid diagonally
across the three bookmark ribbons, running from lower-left to upper-right.

Chain specs:
- 4–5 interlocking oval links, each about the width of one bookmark ribbon
- Flat, solid, muted dark grey (#606060), no shine, no gradients, no
  highlights, no glow — same flat shading style as the bookmarks themselves
- The break is a single clean gap between two adjacent links; the two halves
  drift slightly apart (3–4px gap). No spark, no flare, no explosion effect,
  no star burst — just empty space between the links
- Chain sits in front of the bookmarks at full opacity; do not blur or
  fade the chain
- Do not alter the bookmarks or their shading in any way

Background: fully transparent
Output: flat PNG, 1024×1024 pixels
Style: flat material design, same visual language as the existing icon
```

### Step 2 — Composite onto teal background

Using the Step 1 result as context, prompt:

```
Using the previous result, produce a clean version of the same icon
where the teal rounded-square background is flat and solid (#064C5C)
with no outer glow, vignette, or atmospheric lighting effect —
identical to the original MyDeck icon background style.

Output: flat PNG, 1024×1024 pixels
```

If the glow persists, follow up with:

```
Remove all drop shadow, outer glow, and bloom effects from the
background. The rounded square should be a single flat solid colour
(#064C5C) reaching fully to the edges of the canvas with no
gradients or lighting.
```

### Troubleshooting prompts

**Decorative chain:** Add — `The chain should look like a simple hardware
store chain — plain flat oval links, no decorative elements, no beveling,
no texture.`

**Dramatic break effect:** Replace the break description with — `The break is
represented only by a 4px gap between two links. One link is shifted 6px away
from its neighbour. Nothing else marks the break — no effects whatsoever.`

**Bookmarks repositioned:** Add — `The three bookmark ribbons must remain
pixel-identical to the source — same position, same size, same colours, same
shading. Only add the chain; change nothing else.`

---

## Output files

All files go in `public/`. The 1024px PNG from Step 2 is the master; derive
all other sizes from it.

| File | Size | Tool | Purpose |
|---|---|---|---|
| `icon-1024.png` | 1024×1024 | (AI output) | Master / source of truth |
| `icon-512.png` | 512×512 | Squoosh | PWA manifest `any` |
| `icon-maskable-512.png` | 512×512 | Maskable.app | PWA manifest `maskable` |
| `icon-192.png` | 192×192 | Squoosh | PWA manifest fallback |
| `apple-touch-icon.png` | 180×180 | Squoosh | iOS home screen |
| `favicon.ico` | multi-size | favicon.io/favicon-converter | Favicon; ICO format preferred for broad support |
| `favicon.svg` | — | Vectorizer.ai | Optional SVG favicon (nothing breaks without it) |

**Favicon tip:** for a sharp favicon, crop the 1024px PNG so the teal square
fills ~95% of the canvas before converting (minimal outer padding). Better still:
use a square-cropped version with the teal background extended to the canvas
edges — rounded corners just waste pixels at 16–32px.

**v2 improvements needed:** (1) favicon — current ICO has too much padding around
the graphic; (2) maskable icon — content sits slightly small for aggressive
Android crops and has a minor star artifact in the lower-right corner.

**Maskable check:** open `icon-1024.png` in [maskable.app](https://maskable.app)
and verify the bookmarks and chain are fully inside the safe-zone circle before
exporting the maskable variant.

**Small-size check:** drag `icon-512.png` into a browser tab and zoom out to
~32px. The chain should still read. If it disappears, the grey is too light;
request a repeat with `#404040`.

---

## Code changes

### `index.html`

Replace the existing single favicon link:

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.webmanifest" />
```

If an SVG favicon is later produced, add it before the `.ico` line:

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
```

### `public/manifest.webmanifest` (new file)

```json
{
  "name": "MyDeck Console",
  "short_name": "Console",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "start_url": "./",
  "display": "standalone",
  "background_color": "#064C5C",
  "theme_color": "#064C5C"
}
```

### `src/ui-v2/components/AboutView.svelte` — header section

Replace the current centered `brand-icon` (MdiInfo) + `<h2>` block with the
Android `MyDeckBrandHeader` pattern: icon left, vertical divider, app name right.

**HTML** — replace the first `<section class="card centered">` block:

```svelte
<section class="card">
  <div class="brand-header">
    <img src="{import.meta.env.BASE_URL}icon-192.png" alt="" width="72" height="72" class="brand-icon-img" />
    <div class="brand-divider" aria-hidden="true"></div>
    <div class="brand-text">
      <div class="brand-name">MyDeck Console</div>
      <div class="version">Version {APP_VERSION}</div>
    </div>
  </div>
  <p class="description">
    A Readeck bookmark repair companion focused on triage, candidate review,
    and safe replacement lineage.
  </p>
</section>
```

**CSS** — add to the `<style>` block; remove the old `.brand-icon`, `.centered`,
and `h2` rules:

```css
.brand-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
}
.brand-icon-img {
  border-radius: 16px;
  flex-shrink: 0;
}
.brand-divider {
  width: 1px;
  height: 52px;
  background: var(--md-sys-color-outline);
  opacity: 0.6;
  flex-shrink: 0;
}
.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.brand-name {
  font-size: 1.35rem;
  font-weight: 500;
  line-height: 1.2;
}
```
