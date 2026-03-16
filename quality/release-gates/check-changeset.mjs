import fs from "node:fs";
import path from "node:path";

const changesetDir = path.resolve(process.cwd(), ".changeset");
const hasDir = fs.existsSync(changesetDir);

if (!hasDir) {
  console.error("❌ Missing .changeset directory");
  process.exit(1);
}

const files = fs
  .readdirSync(changesetDir)
  .filter((file) => file.endsWith(".md") && file !== "README.md");

if (files.length === 0) {
  console.error("❌ No changeset found. Add one with: npm run changeset");
  process.exit(1);
}

console.log(`✅ Changeset gate passed (${files.length} file(s)).`);
