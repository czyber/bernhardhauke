import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import remarkGfm from "remark-gfm";

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
    },
  },
});
