import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const articles = defineCollection({
  loader: glob({ base: "./src/content/articles", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    year: z.number(),
    status: z
      .enum(["Exploring", "Active", "Shipped", "Archived"])
      .default("Active"),
    stack: z.array(z.string()).default([]),
    link: z.url().optional(),
    repo: z.url().optional(),
    showRepoStars: z.boolean().default(false),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const labs = defineCollection({
  loader: glob({ base: "./src/content/labs", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    startedDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    status: z
      .enum(["Exploring", "Active", "Paused", "Archived"])
      .default("Active"),
    focus: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { articles, projects, labs };
