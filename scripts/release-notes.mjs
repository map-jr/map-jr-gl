// Prints the section of CHANGELOG.md for one version, without its heading. The workflow `Release` uses it as the text
// of the release on GitHub. Usage: node scripts/release-notes.mjs <version> [path of the changelog]
import { readFileSync } from 'node:fs';

const [version, file = 'CHANGELOG.md'] = process.argv.slice(2);
if (!version) {
  console.error('[map-jr-gl] release-notes: give the version, for example "node scripts/release-notes.mjs 0.3.0".');
  process.exit(1);
}
const lines = readFileSync(file, 'utf8').split('\n');
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const heading = new RegExp(`^## ${escaped}(\\s|$)`);
const start = lines.findIndex((line) => heading.test(line));
if (start < 0) {
  console.error(`[map-jr-gl] release-notes: ${file} has no section "## ${version}". Add it in the pull request that changes the version.`);
  process.exit(1);
}
let end = lines.findIndex((line, i) => i > start && /^## /.test(line));
if (end < 0) end = lines.length;
const notes = lines.slice(start + 1, end).join('\n').trim();
if (!notes) {
  console.error(`[map-jr-gl] release-notes: the section "## ${version}" of ${file} is empty. Write the entry of the version.`);
  process.exit(1);
}
process.stdout.write(notes + '\n');
