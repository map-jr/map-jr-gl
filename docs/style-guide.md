# Style guide for the docs

This guide is for everyone who writes a page of the user docs or a TSDoc comment on a public type, people and
agents alike. The sentence rules are in "Writing" of [CLAUDE.md](../CLAUDE.md). This guide says what belongs on a
page and what does not. `scripts/docs-lint.mjs` checks the rules that have "(lint)" after them.

The user docs are the folders `docs/guide/`, `docs/reference/`, `docs/recipes/` and `docs/migrate/`. They are plain
GitHub markdown. The package ships them, GitHub shows them, and the docs site builds its pages from them.

## The reader

The reader is a developer who wants to do one thing now. They scan the page, copy code, and leave. An agent reads
the same page with no memory of any other page. Write each page so that it works alone.

## Document the contract, not the mechanism

This is the main rule. A page says what the user gives the library, what the library gives back, and what the user
can observe. It does not say how the code gets there.

**The delete test.** Read each sentence and ask: would the reader write different code, or decide differently,
without it? If not, delete the sentence.

A fact about the inside of the library stays in two cases, and it is then written as what the user sees:

- **A limit that the user can reach.** State the limit and what happens beyond it.
- **A cost that the user can avoid, or an order that the user can rely on.** State the cost or the order.

| In the docs today | Why it fails | Write |
|---|---|---|
| "The map asks the engine at most once in a frame, for the last position of the pointer, so the value can come one frame after the move." | It explains the mechanism of a fact that fits in six words. | "`state.pointer` can be one frame late." |
| "…draws the state that was set for the old one (`test/host.mjs` checks this with a GeoJSON source of `sources`)." | The reader cannot use the name of a test. | The sentence without the parenthesis. |
| "Up to version 0.5, these three fields were inside a field `extend`, which no longer exists." | History belongs in `CHANGELOG.md`. | Nothing. |
| "The map makes this texture with its first such image at 256 by 256 pixels (256 KB), and doubles its width and height, up to 2048 by 2048 pixels (16 MB), when the images do not fit." | Only the upper limit can matter to a user. | The limit and what happens to an image beyond it, or nothing when no user reaches it. |
| "Checked: the configuration above with Next.js 16.4.6. The development servers were not run for this page." | A test log is not documentation. | The configuration, and the versions that it supports in a table when the answer differs by version. |
| "`createMap` takes it, and `update` and `patch` take it again to change the map." | It lists the functions that accept the thing and does not say what the thing is. | "The description is one object that states everything that a map shows: the style, the data, the view and the controls. To change the map, give a new description." |
| "`MapDescription` extends `MapSetup`, so these fields are written in the same object." | It describes how the types are built. | "The map reads these fields only when it is made. To change one, destroy the map and make a new one." |
| "A name that is not in the tables below has no effect." "A description with no `style` throws an error in `createMap`, `update` and `patch`." | Every developer assumes both. | Nothing. |
| "`patch` keeps the fields that it is not given." (on the page of the description) | It is a fact about `patch`. | The sentence in the entry of `patch`. |
| "A new URL or a new object loads that style. Two cases load nothing: an object with the same content […], an object that differs only in its `layers` […]." | It lists the branches of the code. | "The map applies a changed `style` in place where it can. Any other new style is loaded, and the map draws from the start." |

The user docs never contain these (lint):

- the name of a test file or of a file of `src/`, `scripts/` or `test/`;
- an issue or pull request number;
- a past version of this library, or what the library did before;
- the date of a measurement, or the words "checked", "measured" and "seen in" as evidence;
- a size in bytes, except on `guide/size-and-speed.md`, which reads the figures that `pnpm status` writes.

Such a fact is not lost. A decision goes into its issue, history into `CHANGELOG.md`, a measurement into its pull
request, and a note for contributors into `docs/development.md`.

## Write for the user, not from the source

A writer who has the source open tends to write what the source shows. These rules keep that out of a page.

- **An opening says what the thing is and what it is for.** It does not list the functions that take or return the
  thing.
- **The content starts at once.** A page has no section of general rules before it. Do not state what every
  developer assumes: that an unknown name has no effect, that a missing required field is an error, that the
  development build warns about a mistake.
- **Do not describe how the types are built.** Phrases such as "A extends B" and "is a union of" tell the reader
  nothing to do. Say what the reader does differently.
- **State behaviour as what the user can rely on, in one statement.** A list of cases comes after it, and has only
  the cases in which the user must act.
- **Leave out the errors of plain misuse,** or put them in a short section at the end of the entry. Describe a
  failure where the reader meets it only when a correct program can meet it, such as a style that does not load.

## One home for each fact

A fact is written on one page. Other pages link to it. The home of a field, a method, an event or an option is its
reference entry. The home of a task is its recipe or its guide. When two pages need the same paragraph, one of them
needs a link. A fact about another member lives in the entry of that member: what `patch` does is not on the page
of the description.

## The page types

Every page has one type, and the folder shows it.

| Type | Folder | The reader asks | Has | Does not have |
|---|---|---|---|---|
| Guide | `guide/` | "How does this part work, and how do I use it?" | One topic in the order in which a user meets it, with short examples | A complete list of options |
| Concept | `guide/` | "Which one do I choose, and why?" | A comparison and a recommendation | Steps |
| Recipe | `recipes/` | "How do I do X?" | Complete code for one goal | Background, lists of options |
| Reference | `reference/` | "What exactly does it take and return?" | Every member with type, default and description | Instructions, reasons, opinion |
| Migration | `migrate/` | "What do I change?" | Numbered steps and tables from the old name to the new one | A tour of features |

### Guide

```markdown
# Markers and popups

One or two sentences: what the reader can do after this page.

## The first task, as a heading

One sentence, then code in each variant that differs.

What the reader sees, and the one or two things that most often go wrong.

## The next task

## See also

- Links to the reference entries and the recipes.
```

- A guide teaches the usual path. An unusual case gets one sentence and a link, or nothing.
- A concept page starts with a table that compares the choices and ends with a recommendation.

### Recipe

```markdown
# Query what is at a position

One sentence that says what the code does.

<!-- example:query:start -->
(the forms of the example; `scripts/recipes.mjs` writes this block)
<!-- example:query:end -->

## How it works

Three to five short points on the lines that matter, each with a link to the reference.

## Variations

Short changes of the code above, each with its own heading and only the lines that differ.

## See also
```

- The title is the goal in the words that a user searches for.
- The code is a complete file in every variant. It comes from a file of `examples/`, which the tests run.
- Write a recipe for a task that many applications have. A task that one application in a hundred has gets none.
- A recipe for a complex case is a starting point. It says what it leaves out.

### Reference

```markdown
# The description

One sentence that says what the thing is, and a link to the guide that teaches it.

## `MapDescription`

<!-- ref:MapDescription:start -->
| Name | Type | Default | Description |
|---|---|---|---|
| `style` **required** | `string \| StyleSpecification` | | The style, or the URL of a style. |
<!-- ref:MapDescription:end -->

## `style`

A section for each member that needs more than its row: the accepted forms, what a change does, the warning
for a mistake, what is not supported, one short example, and "See also".
```

- `scripts/reference.mjs` writes the tables from the types and the TSDoc of `src/`. To change a row, change the
  comment in the source.
- A row description is one sentence of at most 200 characters (lint). More goes into a section for the member, and
  the name in the row links to it.
- A method has its signature, a table of parameters, **Returns** with the type, and the errors and warnings.
- The order is that of the source, and every entry has the same parts in the same order.
- A reference states what is not supported and what the library does then. It gives no advice and no reasons.

### Migration

- A migration page has numbered steps with code before and after, and then tables.
- A mapping table has the columns "MapLibre GL JS", "Map Jr. GL" and "Notes", one row for each name.
- A difference in behaviour is one row or one short section with a code example. Its explanation is at most three
  sentences. How MapLibre GL JS works inside is not part of it.

## Code

- Code comes first. At most one sentence stands before a code block, and it says what the code does.
- Every example runs as it is written: it has its imports, a real URL and the setup.
- On a guide, the first block of each variant is complete. A later `js` block of the same variant can continue it:
  it uses the names that the first block declares (`map`, `places`), and the sentence before the group says so. A
  component (`vue`, `jsx`, `svelte`) is complete each time. On a reference page, a block can leave out the import of
  `createMap` after the first block of the page.
- Use the style `https://styles.map-jr.org/1/elevation-zero.json` unless the example is about another style.
- Use names from a real application (`stations`, `selectedTrail`), not `foo` or `myLayer1`.
- A comment in the code says why a line is there, for the one or two lines that need it.
- Every fence has a language (lint).

### Variants

The library has seven ways to write the same map. A page gives a variant when its code differs.

| Label | For | Fence |
|---|---|---|
| `[Main API]` | `@map-jr/map-jr-gl` | `js` or `ts` |
| `[MapLibre compat]` | `@map-jr/map-jr-gl/maplibre-compat` | `js` or `ts` |
| `[Vue]` | `@map-jr/map-jr-gl/vue` | `vue` |
| `[Nuxt]` | `@map-jr/map-jr-gl/nuxt` | `vue` |
| `[React]` | `@map-jr/map-jr-gl/react` | `jsx` or `tsx` |
| `[Svelte]` | `@map-jr/map-jr-gl/svelte` | `svelte` |
| `[<map-jr>]` | `@map-jr/map-jr-gl/element` | `html` |

- Write the label after the language: ```` ```vue [Vue] ````. The site joins adjacent fences into one switcher that
  remembers the reader's choice.
- Write the label again in bold on a line of its own before the fence: `**Vue**`, and the element as
  ``**`<map-jr>`**`` (lint). GitHub and the package show the fences one after the other and do not show the label of
  a fence, so this line is what tells the reader there which variant the code is. The site removes the line when it
  builds the switcher.

  ````markdown
  **Main API**

  ```js [Main API]
  map.patch({cursor: 'crosshair'});
  ```

  **MapLibre compat**

  ```js [MapLibre compat]
  map.getCanvas().style.cursor = 'crosshair';
  ```
  ````

- Keep the order of the table, and put no other text between the fences of one group (lint).
- Leave out a variant whose code would be the same as another one. Leave out `[Nuxt]` when it differs from `[Vue]`
  only in the imports, and say once on the page for Nuxt that the imports are not needed.
- A page about one entry (`reference/vue.md`) has no labels.

## Tables, callouts and headings

- Use a table for parallel items with the same parts, and a list for steps.
- A table cell is at most 200 characters (lint). A cell holds a value or one sentence.
- A number has its own column, so that the reader can compare down the column.
- A page has at most two callouts (`> **Note**`), and never two in a row (lint). A callout is for something that
  breaks the reader's code when they miss it.
- A heading names the task or the thing: "Change the data of a source", not "Data handling". No page has a
  heading "Overview" or "Introduction" (lint). A page has one `#` heading, and no level below `###` (lint).
- A paragraph is at most 90 words (lint).
- Link with the name of the target: "see [`padding`](reference/description.md#padding)", not "see here" or "see
  above". Links between pages are relative and end in `.md`, so that they work on GitHub and in the package. A link
  leads to a file that exists, and its anchor to a heading of that file (lint).

## TSDoc

The comment on a public member is the row of the reference and the text that an editor shows on hover.

```ts
/**
 * The largest pitch that the user can reach, in degrees. A value above 90 gives 90 and one warning.
 * @default 60
 */
maxPitch?: number;
```

- The first sentence is the contract. It fits into a table row.
- `@default` has the value as code. Leave it out when the member is required or has no default.
- A method has `@param` for each parameter that its name does not explain, and `@returns`.
- The comment does not say how the member is implemented or where it is used inside the library.

## When the library makes a page hard to write

Sometimes a page needs a paragraph only because the API is irregular: an exception to a rule, an option with no
name for its type, a mistake that gives no message. Do not hide this with more text. Document the library as it
is, in the shortest form, and name the change that would remove the paragraph in the report of your work, so that
it becomes an issue with the label `area: dx`.

## Before you open the pull request

1. Run `node scripts/docs-lint.mjs` and `pnpm test:consistency`.
2. Do the delete test on every sentence.
3. Do the smell test. Read the page for sentences that only a person who looks at the source could write: they
   name how things are composed, list the branches of the code, or state a guarantee that nobody would doubt. Cut
   them.
4. Check every claim against `src/` or by running the code. The pull request lists what was run.
5. List in the pull request the facts that the old page had and the new page does not, with one reason for each
   group ("history", "mechanism", "moved to the reference").
6. Read the page on GitHub in the branch: it must read well there with no site.
