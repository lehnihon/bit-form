import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bit-form-compat-"));

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function writeJson(filePath, content) {
  fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, "utf-8");
}

function createConsumer(name, files) {
  const dir = path.join(tempRoot, name);
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });

  writeJson(path.join(dir, "tsconfig.json"), {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      skipLibCheck: true,
      strict: true,
      jsx: "react-jsx",
      types: ["node"],
    },
    include: ["src"],
  });

  Object.entries(files).forEach(([relativePath, content]) => {
    fs.writeFileSync(path.join(dir, relativePath), content, "utf-8");
  });

  return dir;
}

function packLibrary() {
  const result = spawnSync("npm", ["pack", "--json"], {
    cwd: repoRoot,
    encoding: "utf-8",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || "npm pack failed");
  }

  const parsed = JSON.parse(result.stdout);
  const fileName = parsed?.[0]?.filename;

  if (!fileName) {
    throw new Error("Unable to detect generated tarball from npm pack");
  }

  return path.join(repoRoot, fileName);
}

try {
  const tarballPath = packLibrary();

  const basePackage = {
    private: true,
    type: "module",
    scripts: {
      build: "tsc --noEmit",
    },
    dependencies: {
      "@lehnihon/bit-form": `file:${tarballPath}`,
    },
    devDependencies: {
      typescript: "^5.7.3",
      "@types/node": "^22.19.11",
    },
  };

  const reactDir = createConsumer("react", {
    "src/main.tsx": `import React from "react";\nimport { createBitStore } from "@lehnihon/bit-form";\nimport { BitFormProvider, useBitField } from "@lehnihon/bit-form/react";\n\nconst store = createBitStore({ initialValues: { name: "" } });\n\nfunction Field() {\n  const field = useBitField("name");\n  return React.createElement("input", field.props);\n}\n\nexport const app = React.createElement(BitFormProvider, {\n  store,\n  children: React.createElement(Field),\n});\n`,
  });

  writeJson(path.join(reactDir, "package.json"), {
    ...basePackage,
    dependencies: {
      ...basePackage.dependencies,
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
    devDependencies: {
      ...basePackage.devDependencies,
      "@types/react": "^19.0.8",
      "@types/react-dom": "^19.0.3",
    },
  });

  const vueDir = createConsumer("vue", {
    "src/main.ts": `import { createBitStore } from "@lehnihon/bit-form";\nimport { provideBitStore, useBitField } from "@lehnihon/bit-form/vue";\n\nconst store = createBitStore({ initialValues: { email: "" } });\nprovideBitStore(store);\nconst field = useBitField("email");\nexport const value = field.value.value;\n`,
  });

  writeJson(path.join(vueDir, "package.json"), {
    ...basePackage,
    dependencies: {
      ...basePackage.dependencies,
      vue: "^3.5.13",
    },
  });

  const angularDir = createConsumer("angular", {
    "src/main.ts": `import { createBitStore } from "@lehnihon/bit-form";\nimport { provideBitStore, injectBitField } from "@lehnihon/bit-form/angular";\n\nconst store = createBitStore({ initialValues: { age: "" } });\nexport const providers = [provideBitStore(store)];\nexport const field = injectBitField("age");\n`,
  });

  writeJson(path.join(angularDir, "package.json"), {
    ...basePackage,
    dependencies: {
      ...basePackage.dependencies,
      "@angular/core": "^21.1.3",
      rxjs: "^7.8.1",
    },
  });

  [reactDir, vueDir, angularDir].forEach((dir) => {
    run("npm", ["install", "--no-audit", "--no-fund"], dir);
    run("npm", ["run", "build"], dir);
  });

  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.rmSync(tarballPath, { force: true });

  console.log("✅ Compat smoke passed for React, Vue and Angular consumers.");
} catch (error) {
  console.error("❌ Compat smoke failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
