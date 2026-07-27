import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicWebRoots = [
  path.join(projectRoot, "apps", "web", "src"),
  path.join(projectRoot, "apps", "web", "public")
];
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx"
]);
const forbiddenImageUrl =
  /https?:\/\/(?:www\.)?bjjheroes\.com\/[^\s"'`)]*\.(?:avif|gif|jpe?g|png|webp)(?:\?[^\s"'`)]*)?/gi;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(fullPath)));
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

const violations = [];
for (const root of publicWebRoots) {
  for (const file of await collectFiles(root)) {
    const content = await readFile(file, "utf8");
    for (const match of content.matchAll(forbiddenImageUrl)) {
      violations.push({
        file: path.relative(projectRoot, file),
        url: match[0]
      });
    }
  }
}

if (violations.length) {
  console.error("[media-policy] External BJJ Heroes image URLs found in public web assets:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.url}`);
  }
  console.error(
    "[media-policy] Use only an owned or compatibly licensed local file and keep its attribution."
  );
  process.exit(1);
}

console.log(
  "[media-policy] Passed: no BJJ Heroes image URL is shipped by the public application."
);
