// A stand-in for @nuxt/kit: it records what the module registers (test/unit/nuxt.test.ts).
export const calls = {components: [], imports: []};
export const defineNuxtModule = def => def;
export const addComponent = c => calls.components.push(c);
export const addImports = list => calls.imports.push(...list);
