import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esbuild = path.join(root, "node_modules", ".bin", "esbuild");

const result = spawnSync(
  esbuild,
  [
    "src/animations/llm-serving/text-to-tokens.tsx",
    "--bundle",
    "--format=esm",
    "--jsx=automatic",
    "--jsx-import-source=@motion-canvas/2d/lib",
    "--outfile=public/articles/llm-serving/text-to-tokens-animation.js",
  ],
  {
    cwd: root,
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
