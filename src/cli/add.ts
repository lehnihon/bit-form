import * as fs from "node:fs";
import * as path from "node:path";
import { getAdapter, listAdapters } from "./adapters";

const DEFAULT_UI_PATH = "@/components/ui";

export interface AddFlags {
  path: string;
  uiPath: string;
  overwrite: boolean;
  yes: boolean;
}

function parseAddArgs(args: string[]): {
  adapter: string;
  components: string[];
  flags: AddFlags;
} {
  const adapter = args[0] ?? "";
  const rest = args.slice(1);

  let pathDir = ".";
  let uiPath = DEFAULT_UI_PATH;
  let overwrite = false;
  let yes = false;
  const components: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--path") {
      if (!rest[i + 1]) {
        throw new Error("bit-form add: --path requires a value");
      }
      pathDir = rest[i + 1];
      i++;
    } else if (arg === "--ui-path") {
      if (!rest[i + 1]) {
        throw new Error("bit-form add: --ui-path requires a value");
      }
      uiPath = rest[i + 1];
      i++;
    } else if (arg === "--overwrite") {
      overwrite = true;
    } else if (arg === "--yes" || arg === "-y") {
      yes = true;
    } else if (arg.startsWith("--")) {
      // skip unknown flags
    } else {
      components.push(arg);
    }
  }

  return {
    adapter,
    components,
    flags: { path: pathDir, uiPath, overwrite, yes },
  };
}

function hasComponentsJson(cwd: string): boolean {
  const p = path.join(cwd, "components.json");
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function runAddCommand(args: string[]): void {
  const { adapter: adapterName, components, flags } = parseAddArgs(args);

  if (!adapterName) {
    throw new Error(
      "bit-form add: missing adapter name. Example: bit-form add shadcn input",
    );
  }

  const adapter = getAdapter(adapterName);
  if (!adapter) {
    throw new Error(
      `bit-form add: unknown adapter "${adapterName}". Available: ${listAdapters().join(", ")}`,
    );
  }

  const toAdd = components.length > 0 ? components : adapter.components;

  if (toAdd.length === 0) {
    throw new Error(
      "bit-form add: specify at least one component or use no arguments to add all.",
    );
  }

  const cwd = process.cwd();
  const outDir = path.resolve(cwd, flags.path);

  const relativeToProject = path.relative(cwd, outDir);
  if (
    relativeToProject.startsWith("..") ||
    path.isAbsolute(relativeToProject)
  ) {
    throw new Error(
      `bit-form add: output directory must be inside the project root (resolved: ${outDir})`,
    );
  }

  // Project detection: for shadcn, warn if components.json is missing
  if (adapter.name === "shadcn" && !hasComponentsJson(cwd)) {
    console.warn(
      "Warning: components.json not found in project root. Make sure shadcn/ui is initialized (e.g. npx shadcn@latest init) or pass --ui-path to match your setup.",
    );
  }

  try {
    fs.mkdirSync(outDir, { recursive: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(
      `bit-form add: could not create output directory: ${message}`,
      {
        cause: e,
      },
    );
  }

  const ctx = {
    cwd,
    path: outDir,
    uiPath: flags.uiPath,
    overwrite: flags.overwrite,
    yes: flags.yes,
  };

  for (const comp of toAdd) {
    const { filename, contents } = adapter.renderComponent(comp, ctx);
    const filePath = path.join(outDir, filename);

    if (!flags.overwrite && fs.existsSync(filePath)) {
      console.log(`Skip ${filename} (exists; use --overwrite to replace)`);
      continue;
    }

    fs.writeFileSync(filePath, contents, "utf-8");
    console.log(`Created ${filename}`);
  }
}
