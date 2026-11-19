// Lists the members of MapDescription and MapEvents and the props of MapJr with the API of TypeScript 7.
// Usage: node spike/ts-probe/list-types.mjs [--all]
import {fileURLToPath} from 'node:url';
import {API, SymbolFlags} from 'typescript/unstable/sync';

const config = fileURLToPath(new URL('./tsconfig.json', import.meta.url));
const all = process.argv.includes('--all');
const started = performance.now();
const api = new API();
const snapshot = api.updateSnapshot({openProjects: [config]});
const project = snapshot.getProject(config) ?? snapshot.getProjects()[0];
const {checker, program} = project;
const file = program.getSourceFile(fileURLToPath(new URL('./probe.ts', import.meta.url)));
console.log('diagnostics of the probe:', program.getSemanticDiagnostics(file.fileName).length);

function list(name) {
    const symbol = checker.resolveName(name, SymbolFlags.Type, file);
    if (!symbol) return console.log(name + ': not found');
    const type = checker.getDeclaredTypeOfSymbol(symbol);
    const members = checker.getPropertiesOfType(type);
    console.log(`\n${name}: ${members.length} members`);
    for (const member of all ? members : members.slice(0, 6)) {
        const memberType = checker.getTypeOfSymbol(member);
        const optional = member.flags & SymbolFlags.Optional ? '?' : '';
        const doc = checker.getDocumentationCommentOfSymbol(member);
        const tags = checker.getJsDocTagsOfSymbol(member);
        const where = member.declarations[0]?.path.split('/').slice(-2).join('/');
        console.log(`  ${member.name}${optional}: ${checker.typeToString(memberType).slice(0, 110)}`);
        console.log(`      doc: ${JSON.stringify(doc.slice(0, 110))}  tags: ${JSON.stringify(tags)}  from: ${where}`);
    }
    return members;
}
list('Description');
list('Events');
const props = list('Props');
list('Tagged');
if (props) console.log('\nprops with a doc comment:', props.filter(prop => checker.getDocumentationCommentOfSymbol(prop)).length, 'of', props.length);
console.log(`\n${Math.round(performance.now() - started)} ms`);
api.close();
