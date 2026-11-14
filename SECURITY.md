# Security

Map Jr. GL is a project of Sam Margulies and whatismyelevation.com. This page says how to report a vulnerability and
which problems count as one.

## Report a vulnerability

Report a vulnerability privately through GitHub:

1. Open the repository [map-jr/map-jr-gl](https://github.com/map-jr/map-jr-gl) and select the **Security** tab.
2. Select **Report a vulnerability** and fill in the form.

The report is visible only to you and the maintainers. Do not open a public issue or pull request for a
vulnerability. There is no email contact.

A useful report has the version of the package, the entry (`@map-jr/map-jr-gl` or
`@map-jr/map-jr-gl/maplibre-compat`), the smallest style, tile or file that shows the problem, and what happens. The
project is maintained by one person, so an answer can take some days.

## Supported versions

The package is version 0.x. Only the latest published version gets fixes.

## What is in scope

Styles, TileJSON, tiles, glyph files, sprites and GeoJSON come from other parties, and the library treats them as
untrusted input. These are vulnerabilities:

- Input that runs script or puts its text into the page as HTML. Examples are a style, a TileJSON `attribution`, a
  feature property or a glyph file.
- Input of a small size that makes the page, a tile worker or the server renderer use memory or time without a limit.
- One failed or malformed request that stops the whole map instead of only its own tile or resource.
- State of one map that another map on the same page can read or change.
- A way around the limits of the server renderer (`timeout`, `requestTimeout`, `maxBytes`, `allowHosts`; see
  [Server rendering](docs/server-rendering.md#limits-for-requests)), for example a request that is not counted.

## What is not in scope

- A plugin or an `addProtocol` handler that you load yourself. The library runs their script with the rights of the
  page.
- Requests of the server renderer to hosts that a style names, when `allowHosts` is not set. The renderer fetches the
  URLs of the style from your server, and by default it allows all hosts and `maxBytes` has no limit. Set
  `allowHosts` and `maxBytes` when the style comes from users.
- Problems in MapLibre GL JS, in the demo pages or in the gallery that do not affect the published package.
