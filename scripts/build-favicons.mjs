import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Rasterises public/favicon.svg into the fallbacks crawlers and older browsers ask for.
const publicDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public",
);
const source = path.join(publicDirectory, "favicon.svg");

function png(size, ...options) {
  try {
    return execFileSync(
      "rsvg-convert",
      ["-w", String(size), "-h", String(size), ...options, source],
      { maxBuffer: 16 * 1024 * 1024 },
    );
  } catch (error) {
    if (error.code === "ENOENT")
      throw new Error("rsvg-convert is required (brew install librsvg).");
    throw error;
  }
}

// An ICO file is a small directory followed by one PNG per size.
function ico(sizes) {
  const images = sizes.map((size) => png(size));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach((image, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(sizes[index], entry);
    header.writeUInt8(sizes[index], entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  });
  return Buffer.concat([header, ...images]);
}

const tile = (await readFile(source, "utf8")).match(/<rect[^>]*fill="([^"]+)"/);
if (!tile)
  throw new Error("favicon.svg needs a background <rect> with a fill.");

await writeFile(path.join(publicDirectory, "favicon.ico"), ico([16, 32, 48]));
// Google asks for a square icon in a multiple of 48px.
await writeFile(path.join(publicDirectory, "favicon-96x96.png"), png(96));
// iOS applies its own mask, so the touch icon fills the square.
await writeFile(
  path.join(publicDirectory, "apple-touch-icon.png"),
  png(180, "--background-color", tile[1]),
);
