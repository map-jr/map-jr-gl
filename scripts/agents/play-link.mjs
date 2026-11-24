// Prints a link to the playground of the docs site with the code of a file in it: node scripts/agents/play-link.mjs <file> [--pr <number>]
//
// The playground (/play) reads the code from the address (`#code=`), packed as play.vue packs it: deflate-raw, then
// base64url. With --pr, the link goes to the preview of the docs site that the workflow `Docs site` builds for that pull
// request, which uses the library of the pull request; without it, to https://map-jr.org/play (the library of main).
// The file is the code of the playground: a module that imports from '@map-jr/map-jr-gl' (or the compat entry) and
// draws into the element with the id `map`, as the examples of the playground do.
import {readFileSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';

const args = process.argv.slice(2);
const at = args.indexOf('--pr');
const pr = at >= 0 ? args.splice(at, 2)[1] : undefined;
const file = args[0];
if (!file || (at >= 0 && !/^\d+$/.test(pr ?? ''))) {
    console.error('usage: node scripts/agents/play-link.mjs <file> [--pr <number>]');
    process.exit(2);
}
const code = deflateRawSync(Buffer.from(readFileSync(file, 'utf8'))).toString('base64url');
const site = pr ? `https://pr-${pr}-map-jr-site.belabor.workers.dev` : 'https://map-jr.org';
console.log(`${site}/play#code=${code}`);
