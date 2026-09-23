# Bernhard Hauke

Personal website built with Astro, TypeScript, Tailwind CSS, and local Markdown content collections.

## Commands

```sh
npm install
npm run dev
npm run check
npm run build
npm run build:og
```

## Content

- Articles live in `src/content/articles`
- Projects live in `src/content/projects`
- Site metadata lives in `src/data/site.ts`

Articles can include a VS Code-style explorer with complete source files and
collapsible Markdown explanations attached to line ranges. See the
[code article authoring guide](docs/code-articles.md) and the showcase at
`/articles/a-tiny-gpt-explained-in-place/`.

For interactive SVG tensor grids, see the [tensor figure guide](docs/tensor-figures.md)
and `/articles/tensors-one-square-at-a-time/`.

Code-block copy buttons are opt-in. Add the `copy` property after the fence
language when a block should include one:

````md
```ts copy
const example = true;
```
````
