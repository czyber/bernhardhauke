import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { site } from "../data/site";

type SitemapEntry = {
  path: string;
  lastmod?: Date;
  changefreq?: string;
  priority?: string;
};

const xmlEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const toAbsoluteUrl = (path: string) => new URL(path, site.url).toString();
const toDate = (date: Date) => date.toISOString().split("T")[0];

export const GET: APIRoute = async () => {
  const articles = (await getCollection("articles"))
    .filter((article) => !article.data.draft)
    .map((article) => ({
      path: `/articles/${article.id}/`,
      lastmod: article.data.updatedDate ?? article.data.pubDate,
      changefreq: "monthly",
      priority: "0.8",
    }));

  const projects = (await getCollection("projects"))
    .filter((project) => !project.data.draft)
    .map((project) => ({
      path: `/projects/${project.id}/`,
      changefreq: "monthly",
      priority: "0.7",
    }));

  const labs = (await getCollection("labs"))
    .filter((lab) => !lab.data.draft)
    .map((lab) => ({
      path: `/labs/${lab.id}/`,
      lastmod: lab.data.updatedDate ?? lab.data.startedDate,
      changefreq: "monthly",
      priority: "0.7",
    }));

  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/about/", changefreq: "monthly", priority: "0.7" },
    { path: "/labs/", changefreq: "weekly", priority: "0.8" },
    { path: "/projects/", changefreq: "weekly", priority: "0.8" },
    { path: "/articles/", changefreq: "weekly", priority: "0.8" },
    ...labs,
    ...projects,
    ...articles,
  ];

  const urls = entries
    .map(
      (entry) => `  <url>
    <loc>${xmlEscape(toAbsoluteUrl(entry.path))}</loc>
${entry.lastmod ? `    <lastmod>${toDate(entry.lastmod)}</lastmod>\n` : ""}${
        entry.changefreq
          ? `    <changefreq>${entry.changefreq}</changefreq>\n`
          : ""
      }${entry.priority ? `    <priority>${entry.priority}</priority>\n` : ""}  </url>`,
    )
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    },
  );
};
