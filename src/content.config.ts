import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const articles = defineCollection({
  loader: glob({ base: "./src/content/articles", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    socialDescription: z.string().optional(),
    socialImage: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    codeWorkspace: z.string().optional(),
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

const codeNotes = defineCollection({
  loader: glob({ base: "./src/content/code-notes", pattern: "**/*.md" }),
  schema: z
    .object({
      workspace: z.string(),
      noteId: z.string().regex(/^[a-z0-9-]+$/),
      title: z.string(),
      file: z.string(),
      order: z.number(),
      from: z.string().optional(),
      to: z.string().optional(),
      startLine: z.number().int().positive().optional(),
      endLine: z.number().int().positive().optional(),
    })
    .refine((note) => Boolean(note.from) !== Boolean(note.startLine), {
      message:
        "Use either a unique 'from' source line or 'startLine' for a note.",
    })
    .refine((note) => !(note.to && note.endLine), {
      message: "Use either 'to' or 'endLine', not both.",
    }),
});

export const collections = { articles, projects, labs, codeNotes };
