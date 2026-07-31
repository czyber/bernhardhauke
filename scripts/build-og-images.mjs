import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const articleDirectory = path.join(
  root,
  "public/articles/your-words-are-not-what-the-model-sees",
);
const sourcePath = path.join(articleDirectory, "og-image.svg");
const outputPath = path.join(articleDirectory, "og-image.png");
const newsreaderPath = path.join(
  root,
  "node_modules/@fontsource-variable/newsreader/files/newsreader-latin-standard-normal.woff2",
);
const departureMonoPath = path.join(root, "public/fonts/departure-mono.woff2");

const chromeCandidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => existsSync(candidate));

if (!chrome) {
  throw new Error(
    "Chrome is required to render OG images. Set CHROME_BIN to its executable.",
  );
}

const tempDirectory = await mkdtemp(path.join(tmpdir(), "bernhardhauke-og-"));
const htmlPath = path.join(tempDirectory, "og-image.html");

try {
  const svg = await readFile(sourcePath, "utf8");
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face {
        font-family: "Newsreader Variable";
        font-style: normal;
        font-weight: 200 800;
        src: url("${pathToFileURL(newsreaderPath).href}") format("woff2-variations");
      }
      @font-face {
        font-family: "Departure Mono";
        font-style: normal;
        font-weight: 400;
        src: url("${pathToFileURL(departureMonoPath).href}") format("woff2");
      }
      * { box-sizing: border-box; }
      html, body {
        width: 1200px;
        height: 630px;
        margin: 0;
        overflow: hidden;
        background: #000;
      }
      svg { display: block; }
    </style>
  </head>
  <body>${svg}</body>
</html>`;

  await writeFile(htmlPath, html);
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1200,630",
      "--virtual-time-budget=1000",
      `--screenshot=${outputPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: "inherit" },
  );
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}
