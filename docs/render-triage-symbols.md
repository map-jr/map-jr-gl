# Triage of the symbol render tests

This page gives the cause of each render test that is not a match in seven groups of symbol tests (#1738):
`icon-text-fit`, `text-variable-anchor`, `text-variable-anchor-offset`, `text-field`, `text-keep-upright`,
`text-offset` and `symbol-placement`. It follows the triage of the render tests where one to three tests of a
property differ (#570).

The run used the pinned Chromium (Chrome Headless Shell 159.0.8154.6) on `main` of 2026-11-24. The commit was not recorded; the nearest known one is `6919a886`, the merge-base of the branch with `main`:

```sh
node test/conformance/render.mjs --list \
  --filter='^(icon-text-fit|text-variable-anchor|text-variable-anchor-offset|text-field|text-keep-upright|text-offset|symbol-placement)/'
```

It gave 52 matches of 166 tests, 78 near and 36 that differ. Each image that differs was compared by eye with the
expected image. Of the near tests, only the five marked "seen" were compared; the others say "Not inspected".

The column "Action" says what follows. An issue number is a cause that has its own issue (see the list below
the table). "Label" names a label of `test/conformance/render-expectations/`. "Harness" is a difference of the
test setup that needs no change.

| Test | Result | Cause | Action |
|---|---|---|---|
| `icon-text-fit/both-collision-variable-anchor` | differ 11.3% | A label that collides is hidden instead of being placed at its next anchor of `text-variable-anchor` (2 of 3 labels are drawn). | #1771 |
| `icon-text-fit/both-collision-variable-anchor-text-fit` | differ 13.5% | The fault is the same as in `both-collision-variable-anchor`, with the fitted icon. | #1771 |
| `icon-text-fit/both-padding` | near 1.2% | Not inspected. | none yet |
| `icon-text-fit/both-text-anchor` | near 3.0% | The fitted boxes are a pixel or two off the text (seen). | #1772 |
| `icon-text-fit/both-text-anchor-2x-image-1x-screen` | near 3.3% | Not inspected. | none yet |
| `icon-text-fit/both-text-anchor-1x-image-2x-screen` | near 3.7% | Not inspected. | none yet |
| `icon-text-fit/both-text-anchor-icon-anchor` | near 3.0% | Not inspected. | none yet |
| `icon-text-fit/both-text-anchor-icon-offset` | near 3.9% | Not inspected. | none yet |
| `icon-text-fit/both-text-anchor-2x-image-2x-screen` | near 2.3% | Not inspected. | none yet |
| `icon-text-fit/both-text-anchor-padding` | differ 7.7% | The fitted icon box sits off the text, and `icon-text-fit-padding` is not applied on every side, when `text-anchor` is not `center`. | #1772 |
| `icon-text-fit/enlargen-both-padding` | differ 8.8% | The fitted icon box is narrower on the left than the padding asks for. | #1772 |
| `icon-text-fit/height-padding` | near 1.1% | Not inspected. | none yet |
| `icon-text-fit/height` | near 1.2% | Not inspected. | none yet |
| `icon-text-fit/sdf-dot-text-fit` | near 1.5% | Not inspected. | none yet |
| `icon-text-fit/height-text-anchor-padding` | near 1.8% | Not inspected. | none yet |
| `icon-text-fit/placement-line` | near 1.7% | Not inspected. | none yet |
| `icon-text-fit/stretch-fifteen-part` | near 1.8% | Not inspected. | none yet |
| `icon-text-fit/stretch-nine-part-content` | near 2.3% | Not inspected. | none yet |
| `icon-text-fit/stretch-nine-part-@2x` | near 2.5% | Not inspected. | none yet |
| `icon-text-fit/stretch-nine-part` | near 1.4% | Not inspected. | none yet |
| `icon-text-fit/stretch-nine-part-just-width` | differ 5.3% | The fault is the same as in `stretch-nine-part-just-height`. | #1772 |
| `icon-text-fit/stretch-nine-part-content-collision` | near 2.3% | Not inspected. | none yet |
| `icon-text-fit/stretch-three-part` | near 2.4% | Not inspected. | none yet |
| `icon-text-fit/stretch-nine-part-just-height` | differ 9.3% | The fitted icon box is offset from the text for anchors other than `center`. | #1772 |
| `icon-text-fit/stretch-underscale` | differ 17.7% | The fitted icon is narrower than in MapLibre and offset from the text for anchors other than `center`. | #1772 |
| `icon-text-fit/stretch-two-part` | near 2.4% | Not inspected. | none yet |
| `icon-text-fit/text-variable-anchor-overlap` | differ 44.3% | The fault is the same as in `icon-text-fit/text-variable-anchor`. | #1773 |
| `icon-text-fit/text-variable-anchor` | differ 50.1% | Another set of labels is placed, and a thin sliver of the icon shows beside some labels. | #1773 |
| `icon-text-fit/textFit-anchors-long` | near 4.3% | Not inspected. | none yet |
| `icon-text-fit/textFit-anchors-short` | near 2.3% | Not inspected. | none yet |
| `icon-text-fit/textFit-collision` | near 2.6% | Not inspected. | none yet |
| `icon-text-fit/textFit-grid-short-vertical` | differ 5.3% | The fault is the same as in `textFit-grid-long-vertical`. | label (text-writing-mode, later) |
| `icon-text-fit/textFit-grid-long-vertical` | differ 30.3% | The text is horizontal, because vertical writing is not supported. | label (text-writing-mode, later) |
| `symbol-placement/line` | differ 6.2% | About a third of the icons along the line are missing, and the icons that are drawn start at other points than in MapLibre. | #1774 |
| `symbol-placement/line-center-buffer` | near 1.8% | Not inspected. | none yet |
| `symbol-placement/line-center-upperright` | near 2.1% | Not inspected. | none yet |
| `symbol-placement/line-center` | near 1.5% | Not inspected. | none yet |
| `symbol-placement/line-overlap` | near 1.3% | Not inspected. | none yet |
| `symbol-placement/line-promote-id` | near 1.1% | Not inspected. | none yet |
| `symbol-placement/line-overscaled` | differ 6.6% | The fault is the same as in `symbol-placement/line`, on an overscaled tile. | #1774 |
| `symbol-placement/line-overscaled-debug` | differ 6.4% | Collision boxes are not drawn, and the anchors differ as in `symbol-placement/line`. | label (debug drawing, wontfix) |
| `text-field/formatted` | near 4.8% | The edges of the glyphs differ by a pixel (seen). | harness |
| `text-field/formatted-arabic` | near 4.8% | Not inspected. | none yet |
| `text-field/formatted-images` | near 2.3% | Not inspected. | none yet |
| `text-field/formatted-images-line` | differ 5.1% | A formatted label with images on `symbol-placement: line` is not drawn. | #1776 |
| `text-field/formatted-images-constant-size` | near 1.2% | Not inspected. | none yet |
| `text-field/formatted-grapheme-sections` | differ 15.0% | A combining accent in its own section is not joined to its base letter (the second label shows "a" and a missing glyph). The run also logs a failed request for a Hebrew font. | #1775 |
| `text-field/formatted-images-variable-anchors-justification` | differ 12.1% | Only 5 of the 9 labels are placed, and the diagonal anchors are missing. | #1771 |
| `text-field/formatted-images-multiline` | differ 30.0% | The line breaks of a formatted label with images are ignored, so the label is one line. | #1777 |
| `text-field/formatted-images-vertical` | differ 15.2% | The text is horizontal, because vertical writing is not supported. | label (text-writing-mode, later) |
| `text-field/formatted-images-zoom-dependent-size` | near 1.3% | Not inspected. | none yet |
| `text-field/formatted-text-color` | differ 9.1% | A section with a smaller `font-scale` is centered on the line instead of sitting on the baseline. | #1778 |
| `text-field/formatted-line` | near 4.3% | Not inspected. | none yet |
| `text-field/formatted-vertical-align` | differ 6.8% | `vertical-align` in a section has no effect. | label (vertical-align in format text, later) |
| `text-field/formatted-vertical-align-line` | near 3.8% | Not inspected. | none yet |
| `text-field/formatted-vertical-align-vertical-text` | near 1.2% | Not inspected. | none yet |
| `text-keep-upright/line-placement-true` | near 2.1% | Not inspected. | none yet |
| `text-keep-upright/line-placement-false` | near 2.1% | Not inspected. | none yet |
| `text-keep-upright/line-placement-true-pitched` | near 2.7% | Not inspected. | none yet |
| `text-keep-upright/line-placement-true-rolled` | near 4.0% | Most line labels are missing on a map with roll (seen), although the test counts as near. | roll (#1708, parked by the owner) |
| `text-keep-upright/line-placement-true-offset` | near 2.5% | Not inspected. | none yet |
| `text-keep-upright/line-placement-true-roll-pitch-bearing` | near 4.7% | Not inspected. | none yet |
| `text-keep-upright/line-placement-true-rotated` | near 2.1% | Not inspected. | none yet |
| `text-offset/line-collision` | near 2.1% | Collision circles are not drawn, and the letters of the offset label are spaced wider (seen). | label (debug drawing, wontfix) |
| `text-offset/line-sharp-inside` | near 1.3% | Not inspected. | none yet |
| `text-offset/line-sharp-inside-center` | near 1.3% | Not inspected. | none yet |
| `text-offset/line-sharp-outside-center` | near 1.2% | Not inspected. | none yet |
| `text-offset/line-sharp-outside` | near 1.6% | Not inspected. | none yet |
| `text-variable-anchor/all-anchors` | near 2.3% | Not inspected. | none yet |
| `text-variable-anchor/all-anchors-offset` | near 4.3% | The offset of the text from the anchor is about a pixel smaller (seen). | #1779 |
| `text-variable-anchor/all-anchors-radial-offset-zero` | near 4.4% | Not inspected. | none yet |
| `text-variable-anchor/all-anchors-offset-zero` | near 3.6% | Not inspected. | none yet |
| `text-variable-anchor/all-anchors-icon-text-fit` | differ 5.8% | The fitted icon box and the justification of the second line differ slightly for some anchors. | #1772 |
| `text-variable-anchor/all-anchors-two-dimentional-offset` | near 4.4% | Not inspected. | none yet |
| `text-variable-anchor/all-anchors-two-dimentional-offset-negative` | near 4.4% | Not inspected. | none yet |
| `text-variable-anchor/all-anchors-text-allow-overlap` | near 2.9% | Not inspected. | none yet |
| `text-variable-anchor/all-anchors-two-dimentional-offset-zero` | near 1.2% | Not inspected. | none yet |
| `text-variable-anchor/icon-image` | differ 5.4% | The text next to the icon sits a few pixels closer to the icon than in MapLibre. | #1779 |
| `text-variable-anchor/icon-image-all-anchors` | near 1.7% | Not inspected. | none yet |
| `text-variable-anchor/icon-text-fit-collision-box` | differ 13.8% | Collision boxes are not drawn. | label (debug drawing, wontfix) |
| `text-variable-anchor/pitched-rotated-debug` | differ 6.2% | Collision boxes are not drawn, and placement with pitch differs. | label (debug drawing, wontfix) |
| `text-variable-anchor/pitched` | near 2.9% | Not inspected. | none yet |
| `text-variable-anchor/pitched-offset` | differ 9.5% | Another set of labels is placed on a map with pitch. | #661 |
| `text-variable-anchor/no-animate-zoom` | near 1.5% | Not inspected. | none yet |
| `text-variable-anchor/rotated` | differ 5.5% | Another set of labels is placed on a map with bearing. | #1780 |
| `text-variable-anchor/rotated-offset` | differ 10.9% | The fault is the same as in `text-variable-anchor/rotated`, with an offset. | #1780 |
| `text-variable-anchor/rotated-with-map` | near 2.8% | Not inspected. | none yet |
| `text-variable-anchor/single-justification` | near 2.3% | Not inspected. | none yet |
| `text-variable-anchor/single-line` | near 1.7% | Not inspected. | none yet |
| `text-variable-anchor/pitched-with-map` | differ 8.6% | Another set of labels is placed on a map with pitch. | #661 |
| `text-variable-anchor/text-allow-overlap` | near 1.9% | Not inspected. | none yet |
| `text-variable-anchor/text-translate` | near 1.7% | Not inspected. | none yet |
| `text-variable-anchor/translate-variants/pitched` | near 3.6% | Not inspected. | none yet |
| `text-variable-anchor/top-bottom-left-right` | near 2.9% | Not inspected. | none yet |
| `text-variable-anchor/translate-variants/base` | near 2.0% | Not inspected. | none yet |
| `text-variable-anchor/translate-variants/pitched-and-rotated` | near 1.6% | Not inspected. | none yet |
| `text-variable-anchor-offset/all-anchors` | near 4.4% | Not inspected. | none yet |
| `text-variable-anchor-offset/all-anchors-icon-text-fit` | differ 5.8% | The fault is the same as in `text-variable-anchor/all-anchors-icon-text-fit`. | #1772 |
| `text-variable-anchor-offset/icon-image-all-anchors` | near 1.7% | Not inspected. | none yet |
| `text-variable-anchor-offset/icon-image-offset` | differ 6.3% | Only 4 of the 6 labels are placed, and the diagonal anchors are missing. | #1771 |
| `text-variable-anchor-offset/icon-image` | near 1.7% | Not inspected. | none yet |
| `text-variable-anchor-offset/all-anchors-text-allow-overlap` | near 3.0% | Not inspected. | none yet |
| `text-variable-anchor-offset/icon-text-fit-collision-box` | differ 11.0% | Collision boxes are not drawn. | label (debug drawing, wontfix) |
| `text-variable-anchor-offset/pitched` | near 2.9% | Not inspected. | none yet |
| `text-variable-anchor-offset/no-animate-zoom` | near 1.5% | Not inspected. | none yet |
| `text-variable-anchor-offset/rotated` | differ 5.5% | The fault is the same as in `text-variable-anchor/rotated`. | #1780 |
| `text-variable-anchor-offset/pitched-offset` | differ 9.6% | Another set of labels is placed on a map with pitch. | #661 |
| `text-variable-anchor-offset/pitched-with-map` | differ 8.6% | Another set of labels is placed on a map with pitch. | #661 |
| `text-variable-anchor-offset/single-justification` | near 2.3% | Not inspected. | none yet |
| `text-variable-anchor-offset/rotated-offset` | differ 8.9% | The fault is the same as in `text-variable-anchor/rotated`. | #1780 |
| `text-variable-anchor-offset/rotated-with-map` | near 2.8% | Not inspected. | none yet |
| `text-variable-anchor-offset/text-allow-overlap` | near 1.9% | Not inspected. | none yet |
| `text-variable-anchor-offset/single-line` | near 1.7% | Not inspected. | none yet |
| `text-variable-anchor-offset/top-bottom-left-right` | near 3.9% | Not inspected. | none yet |

## Causes that have their own issue

| Issue | Cause |
|---|---|
| #1771 | With `text-variable-anchor`, a label next to an icon is hidden instead of being placed at its next anchor, so the diagonal anchors are missing. |
| #1772 | The icon box of `icon-text-fit` is offset from the text, and its padding differs, when the anchor is not `center`. |
| #1773 | With `icon-text-fit` and `text-variable-anchor`, another set of labels is placed, and a sliver of the icon shows beside some labels. |
| #1774 | The anchors of icons along a line (`symbol-placement: line`) start at other points than in MapLibre. |
| #1775 | A combining mark in its own section of a formatted `text-field` is not joined to its base character. |
| #1776 | A formatted `text-field` with images is not drawn on `symbol-placement: line`. |
| #1777 | The line breaks of a formatted `text-field` with images are ignored. |
| #1778 | A section with a smaller `font-scale` is centered on the line instead of sitting on the baseline. |
| #1779 | The offset of variable-anchor text from its anchor or icon is a pixel or two smaller than in MapLibre. |
| #1780 | With `text-variable-anchor` on a map with bearing, another set of labels is placed. |
| roll (#1708, parked by the owner) | With `text-keep-upright` on a map with roll, most line labels are missing. |

The pitched tests of `text-variable-anchor` and `text-variable-anchor-offset` belong to #661.

## text-arabic

This section gives the cause of each of the 7 render tests of `text-arabic` (#1733) and says which scripts the
render tests cover (#721). The run used the pinned Chromium on `main` of 2026-11-24 (merge-base `f8c7f16`):

```sh
node test/conformance/render.mjs --list --filter='^text-arabic/' --save=<dir>
```

It gave 0 matches of 7 tests, 5 near and 2 that differ (`line-break` and `multi-paragraph`). Each image was compared by eye with the expected image.

The tests ask for glyph PBFs (`local://glyphs/{fontstack}/{range}.pbf`, font stack `Open Sans Semibold, Arial
Unicode MS Bold`). The library does not take Arabic from glyph files: the browser shapes it with the fonts of the
system (see "Glyphs" in `docs/reference/maplibre-differences.md`). The harness gives Open Sans as a web font, which
has no Arabic, so Arabic falls back to the system fonts. The machine has DejaVu Sans, FreeSerif and Unifont for
Arabic, and neither Noto Sans Arabic nor Arial Unicode MS. Every test therefore differs a little in the shapes of
the Arabic glyphs, and the near tests differ by little else.

| Test | Result | Cause | Action |
|---|---|---|---|
| `text-arabic/mixed-numeric` | near 2.0% | The label along the line is in the right place and order; the Arabic glyphs come from another font. | none (font) |
| `text-arabic/line-break` | differ 6.5% | The two lines break at the same word as in MapLibre; the Arabic glyphs come from another font, and the image is 128 px wide, so the glyphs are a large share of its pixels. | none (font) |
| `text-arabic/persian-and-urdu` | near 2.4% | The lines and their order are as in MapLibre; the Persian and Urdu glyphs come from another font. | none (font) |
| `text-arabic/line-break-mixed` | near 3.5% | The Latin part breaks before `al-Iskandarīyah`, while MapLibre breaks after the hyphen of `al-`. | #1794 |
| `text-arabic/wrapped-mixed-and-numbers` | near 4.9% | Labels wrap into more lines than in MapLibre, `Main` sits at the other end of its line, and the parentheses of `(الملك 123)` are split over two lines in the wrong order. | #1794, #1795 |
| `text-arabic/letter-spacing` | near 3.7% | `text-letter-spacing` is applied to the Latin text of a label that contains Arabic, which MapLibre leaves unspaced, and the label then wraps into more lines and overlaps the label above it. | #1791 |
| `text-arabic/multi-paragraph` | differ 6.8% | The control character U+001C is drawn as a box instead of being dropped, and the empty line of `\n\n` is left out. MapLibre breaks `Maktabat / al- / Iskandarīyah` at the hyphen, and its last line is `lines مكتبة` where this library draws `مكتبة lines`. | #1792, #1793, #1794, #1795 |

### Scripts that the render tests cover (#721)

The render tests of MapLibre GL JS were searched for characters of each script:

| Script | Tests | Result in `render-tests.json` |
|---|---|---|
| Arabic, Persian, Urdu | the 7 tests of `text-arabic` | see above |
| Hebrew | `font-faces/complex-scripts` only | differ |
| Indic (Devanagari and others) | `font-faces/complex-scripts`, `is-supported-script/filter`, `is-supported-script/layout`, `text-local-glyphs/complex-script` | differ, near, near, near |
| Thai | `font-faces/complex-scripts` only | differ |
| Vertical CJK | `text-writing-mode/*`, `font-faces/vertical-forms`, `font-faces/vertical-alternates`, and four tests of `icon-text-fit` and `text-field` | labeled `text-writing-mode` (later); the two `font-faces` tests are near |

No test covers right-to-left Hebrew labels with line breaks, Hebrew or Thai along a line, or Thai line breaking
without spaces. `font-faces/complex-scripts` was not inspected in this triage. #1796 tracks the missing coverage of Hebrew and Thai.
