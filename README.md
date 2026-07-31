# Bernhard Hauke

Personal website built with Astro, TypeScript, Tailwind CSS, and local Markdown content collections.

## Commands

```sh
npm install
npm run dev
npm run check
npm run build
```

## Content

- Articles live in `src/content/articles`
- Projects live in `src/content/projects`
- Site metadata lives in `src/data/site.ts`

Code-block copy buttons are opt-in. Add the `copy` property after the fence
language when a block should include one:

````md
```ts copy
const example = true;
```
````
