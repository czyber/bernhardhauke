import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import remarkGfm from "remark-gfm";
import { fileURLToPath } from "node:url";

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
  vite: {
    resolve: {
      alias: {
        // Monaco 0.56 exposes JS subpaths, but not its icon font stylesheet.
        "monaco-editor-icons": fileURLToPath(
          new URL(
            "../base/browser/ui/codicons/codicon/codicon.css",
            import.meta.resolve("monaco-editor/editor/editor.api.js"),
          ),
        ),
      },
    },
  },
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
