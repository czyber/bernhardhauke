import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { site } from "../data/site";

const xmlEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const toAbsoluteUrl = (path: string) => new URL(path, site.url).toString();

export const GET: APIRoute = async () => {
  const articles = (await getCollection("articles"))
    .filter((article) => !article.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const newestArticle = articles[0];
  const lastBuildDate =
    newestArticle?.data.updatedDate ??
    newestArticle?.data.pubDate ??
    new Date();

  const items = articles
    .map((article) => {
      const url = toAbsoluteUrl(`/articles/${article.id}/`);
      const categories = article.data.tags
        .map((tag) => `      <category>${xmlEscape(tag)}</category>`)
        .join("\n");

      return `    <item>
      <title>${xmlEscape(article.data.title)}</title>
      <link>${xmlEscape(url)}</link>
      <guid isPermaLink="true">${xmlEscape(url)}</guid>
      <description>${xmlEscape(article.data.description)}</description>
      <pubDate>${article.data.pubDate.toUTCString()}</pubDate>
${categories ? `${categories}\n` : ""}    </item>`;
    })
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(site.title)}</title>
    <link>${xmlEscape(site.url)}</link>
    <description>${xmlEscape(site.description)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${xmlEscape(
      toAbsoluteUrl("/rss.xml"),
    )}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`,
    {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    },
  );
};
