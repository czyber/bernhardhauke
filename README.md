# Bernhard Hauke

Personal website built with Astro, TypeScript, Tailwind CSS, and local Markdown content collections.

## Commands

```sh
npm install
npm run dev
npm run check
npm run build
npm run build:og
npm run build:favicons
```

## Content

- Articles live in `src/content/articles`
- Projects live in `src/content/projects`
- Site metadata lives in `src/data/site.ts`

Articles can include a VS Code-style explorer with complete source files and
collapsible Markdown explanations attached to line ranges. See the
[code article authoring guide](docs/code-articles.md).

For interactive SVG tensor grids, see the [tensor figure guide](docs/tensor-figures.md).

For views, transposes, splits, and products composed as mathematical equations,
see the [tensor equation guide](docs/tensor-equations.md).

For token embeddings, stochastic gradient descent, vector attention, and model
diagrams, see the [neural figure guide](docs/neural-figures.md). These components
remain available for future articles; standalone preview posts are not published.

Articles marked `draft: true` are excluded from both development and production
pages. For a finished article, set `draft: false` and generate its social image:

```sh
npm run build:og -- <article-slug>
```

Set `socialImage` in the article frontmatter to
`/articles/<article-slug>/og-image.png`. Run `npm test` and `npm run build` before
publishing. Local research notes and plot previews belong in the ignored `work/`
directory.

The site logo is `public/favicon.svg`. After changing it, regenerate the
`.ico` and PNG fallbacks (requires `rsvg-convert`, from `brew install librsvg`):

```sh
npm run build:favicons
```

Code-block copy buttons are opt-in. Add the `copy` property after the fence
language when a block should include one:

````md
```ts copy
const example = true;
```
````
