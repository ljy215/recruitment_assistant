import { build } from "esbuild";
import { mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(root, "..");
const distDir = join(projectRoot, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(join(distDir, "assets"), { recursive: true });

await build({
  entryPoints: [join(projectRoot, "src", "main.jsx")],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "esm",
  target: ["es2020"],
  outfile: join(distDir, "assets", "main.js"),
  loader: {
    ".js": "jsx",
    ".jsx": "jsx",
    ".css": "css",
  },
});

await copyFile(join(projectRoot, "src", "styles.css"), join(distDir, "assets", "styles.css"));
await writeFile(
  join(distDir, "index.html"),
  `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" href="data:," />
    <link rel="stylesheet" href="/assets/styles.css" />
    <title>AI 招聘提效 Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/main.js"></script>
  </body>
</html>
`,
  "utf-8",
);

console.log("Built frontend with esbuild.");
