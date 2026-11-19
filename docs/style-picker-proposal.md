# Proposed style picker for the main API

[Issue #1158](https://github.com/map-jr/map-jr-gl/issues/1158) asks how a map can offer several styles with a picture of each. This proposal awaits the owner's decision.

## Choosing a style

A page would import `styles` from `@map-jr/map-jr-gl/controls` and pass it an ordered list of entries. Each entry would have a label and a style, and could supply terrain and global state. Two entries could share the Elevation style URL while one uses the style's terrain and the other sets `terrain: null`.

Selecting an entry would apply its style and overrides together, keep the camera in place, and call `onStyleChange(entry)` on the map description once. The callback would report the selection immediately after the description changes. Rendering finishes asynchronously. Switching back from a flat entry must restore the style's terrain. Switching away from a Radar entry that disables relief must clear its relief override. State keys owned by the application should survive a selection.

The picker would use the existing control theme and support touch, keyboard selection, and Escape to close and return focus to the trigger. Each choice would retain its text label when its picture fails. The proposed first version targets the main API. Separate light and dark forms, switches generated from arbitrary state keys, and a compat control would each need a use case before inclusion.

## Drawing the pictures

Prototype a single temporary map per open picker. Draw entries sequentially from the same camera, using the configured preview center and zoom or the live camera sampled when the picker opens. Start with visible entries. On close or removal, release the map and any image URLs and discard late results. A failed or stalled style must allow the next preview to proceed.

A map can show the terrain and state that distinguish two entries with the same URL. Its cost on a phone needs measurement. Hosted pictures would avoid a second map but require a fixed view and an image for each variant. The SVG renderer is another candidate if it can reproduce the differences between the official styles. Use each entry's actual settings for the first comparison. Consider preview-only overrides and the style's server-rendering metadata after comparing their effect on labels, terrain and relief.

## Work after design approval

1. Prototype previews with Elevation, flat Elevation, and Radar with relief disabled. Record time to first picture, additional requests, and gzip bytes for both entries and the lazy chunks. Confirm that a page without the picker downloads no additional bytes up front. Exercise repeated open and close on a phone and removal during a slow preview request.
2. Implement the picker and selection callback. Test switching between entries sharing a URL, returning to style defaults, external description updates, keyboard use, failed pictures, and two maps on one page. Cover the callback in the framework adapters.
3. Document the approved API and add gallery examples. Use the picker on the style pages tracked by #1129 once its behavior and preview cost have been verified.

The owner can approve or revise the selection API and preview prototype independently. Keep #1158 open until the decisions are recorded and the accepted work has implementation issues.
