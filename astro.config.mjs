import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import remarkGfm from "remark-gfm";

const copyCodeTransformer = {
  name: "copy-code-opt-in",
  pre(node) {
    const meta = this.options.meta?.__raw ?? "";
    const properties = new Set(meta.trim().split(/\s+/));

    if (properties.has("copy")) {
      node.properties.dataCopy = "";
    }
  },
};

export default defineConfig({
  markdown: {
    processor: unified({
      remarkPlugins: [remarkGfm],
    }),
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      defaultColor: false,
      wrap: false,
      transformers: [copyCodeTransformer],
    },
  },
});
