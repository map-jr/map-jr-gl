// The page that `pnpm test:package` builds with esbuild and with Vite (see scripts/check-package.mjs). It imports the
// element entry only for its side effect, as a page that uses `<map-jr>` does: the import defines the element.
import '@map-jr/map-jr-gl/element';
