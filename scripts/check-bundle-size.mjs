import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const root = join(process.cwd(), "out", "_next", "static", "chunks");
const maxChunkBytes = 900 * 1024;

async function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJavaScriptFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

const oversized = [];
for (const file of await collectJavaScriptFiles(root)) {
  const { size } = await stat(file);
  if (size > maxChunkBytes) oversized.push({ file: relative(process.cwd(), file), size });
}

if (oversized.length > 0) {
  for (const item of oversized) {
    console.error(`${item.file}: ${(item.size / 1024).toFixed(1)} KiB`);
  }
  throw new Error(`JavaScript chunk exceeds ${maxChunkBytes / 1024} KiB budget`);
}

console.log(`Bundle budget passed: every JavaScript chunk is at most ${maxChunkBytes / 1024} KiB`);
