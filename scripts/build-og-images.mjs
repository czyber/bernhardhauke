import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requestedSlug = process.argv[2];
if (requestedSlug && !/^[a-z0-9-]+$/.test(requestedSlug)) {
  throw new Error(
    "Provide an article slug using lowercase letters, numbers, and hyphens.",
  );
}
const chrome = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
]
  .filter(Boolean)
  .find((candidate) => existsSync(candidate));
if (!chrome)
  throw new Error(
    "Chrome is required to render OG images. Set CHROME_BIN to its executable.",
  );

const font = async (file) =>
  (await readFile(path.join(root, file))).toString("base64");
const serif = await font(
  "node_modules/@fontsource-variable/newsreader/files/newsreader-latin-standard-italic.woff2",
);
const mono = await font("public/fonts/departure-mono.woff2");
const css = await readFile(path.join(root, "src/styles/global.css"), "utf8");
const color = (name) => {
  const value = css.match(new RegExp(`--${name}:\\s*(#[a-fA-F0-9]+);`))?.[1];
  if (!value) throw new Error(`Missing palette color: ${name}`);
  return value;
};
const background = color("background-100");
const foreground = color("gray-1000");
const muted = color("gray-700");
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

// Fixed stars give each article its own exposure without changing between builds.
function starField(key) {
  let seed = [...key].reduce(
    (n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0,
    7,
  );
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  return Array.from({ length: 220 }, () => {
    const x = random() * 1200;
    const y = random() * 630;
    const distance = Math.abs(x - 600) / 600;
    const opacity =
      (0.06 + random() * 0.42) * (0.12 + 0.88 * distance * distance);
    const radius = 0.45 + random() ** 3 * 1.1;
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" fill="${foreground}" opacity="${opacity.toFixed(3)}"/>`;
  }).join("\n");
}

function artwork({ slug, title, date }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <style>
    @font-face { font-family: Newsreader; font-style: italic; font-weight: 200 800; src: url(data:font/woff2;base64,${serif}) format('woff2'); }
    @font-face { font-family: Departure; src: url(data:font/woff2;base64,${mono}) format('woff2'); }
    .meta { font-family: Departure, monospace; font-size: 17px; }
  </style>
  <defs>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" seed="17"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="${background}"/>
  <rect width="1200" height="630" filter="url(#grain)" opacity="0.12" style="mix-blend-mode:soft-light"/>
  ${starField(slug)}
  <text x="72" y="79" class="meta" fill="${foreground}">Bernhard Hauke</text>
  <foreignObject x="110" y="160" width="980" height="310">
    <div xmlns="http://www.w3.org/1999/xhtml" style="height:100%;display:flex;align-items:center;justify-content:center;">
      <h1 style="margin:0;color:${foreground};font-family:Newsreader,Georgia,serif;font-style:italic;font-weight:400;font-size:78px;line-height:1.06;letter-spacing:-1.5px;text-align:center;text-wrap:balance;font-optical-sizing:auto;">${escape(title)}</h1>
    </div>
  </foreignObject>
  <text x="72" y="562" class="meta" fill="${muted}">bernhardhauke.at</text>
  ${date ? `<text x="1128" y="562" text-anchor="end" class="meta" fill="${muted}">${escape(date)}</text>` : ""}
</svg>`;
}

const articlesDirectory = path.join(root, "src/content/articles");
const previews = [];
for (const file of (await readdir(articlesDirectory)).sort()) {
  if (!/\.mdx?$/.test(file)) continue;
  const slug = file.replace(/\.mdx?$/, "");
  if (requestedSlug && slug !== requestedSlug) continue;
  const source = await readFile(path.join(articlesDirectory, file), "utf8");
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) throw new Error(`Missing frontmatter in ${file}`);
  const data = parse(frontmatter[1]);
  if (data.draft) continue;
  if (typeof data.title !== "string" || !data.pubDate)
    throw new Error(`Missing title or date in ${file}`);
  const date = new Date(data.pubDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  previews.push({
    slug,
    title: data.title,
    date,
    directory: path.join(root, "public/articles", slug),
  });
}
if (requestedSlug && !previews.length)
  throw new Error(`No published article found: ${requestedSlug}`);
if (!requestedSlug)
  previews.push({
    slug: "home",
    title: "A focused place for what I am building and learning.",
    directory: path.join(root, "public"),
  });

// Some desktop Chrome builds keep running after writing the screenshot.
// Finish when Chrome confirms the file was written, and always close our renderer.
async function renderImage(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: ["ignore", "ignore", "pipe"] });
    let output = "";
    let written = false;
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("OG image rendering timed out."));
    }, 30000);
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
      if (!written && output.includes("bytes written to file")) {
        written = true;
        child.kill("SIGTERM");
      }
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (written || code === 0) resolve();
      else
        reject(
          new Error(
            `Chrome could not render the image: ${output.slice(-2000)}`,
          ),
        );
    });
  });
}

const tempDirectory = await mkdtemp(path.join(tmpdir(), "bernhardhauke-og-"));
try {
  for (const preview of previews) {
    const svg = artwork(preview).replace(/[ \t]+$/gm, "");
    await mkdir(preview.directory, { recursive: true });
    await writeFile(path.join(preview.directory, "og-image.svg"), svg);
    const htmlPath = path.join(tempDirectory, "og-image.html");
    await writeFile(
      htmlPath,
      `<!doctype html><html><head><meta charset="utf-8"/><style>html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:${background}}svg{display:block}</style></head><body>${svg}</body></html>`,
    );
    await renderImage([
      "--headless=new",
      "--no-first-run",
      "--disable-background-networking",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1200,630",
      "--virtual-time-budget=2000",
      "--no-pdf-header-footer",
      `--user-data-dir=${path.join(tempDirectory, "chrome")}`,
      `--screenshot=${path.join(preview.directory, "og-image.png")}`,
      pathToFileURL(htmlPath).href,
    ]);
    console.log(`Rendered ${preview.slug}: 1200 × 630`);
  }
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
