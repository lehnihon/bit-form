import { getDeepValue } from "./path-value";

export function isWildcardPath(path: string): boolean {
  return path.includes(".*.") || path.endsWith(".*");
}

export function createWildcardRegex(wildcardPath: string): RegExp {
  const escaped = wildcardPath.replace(/\./g, "\\.");
  const regexStr = escaped.replace(/\*/g, "\\d+");
  return new RegExp(`^${regexStr}$`);
}

export function expandWildcardPaths(
  wildcardPath: string,
  values: unknown,
): string[] {
  if (!isWildcardPath(wildcardPath)) {
    return [wildcardPath];
  }

  const pathSegments = wildcardPath.split(".");
  let currentPaths: string[] = [""];

  for (let i = 0; i < pathSegments.length; i++) {
    const seg = pathSegments[i];
    const nextPaths: string[] = [];

    for (const p of currentPaths) {
      if (seg === "*") {
        const arrayPrefix = p.replace(/\.$/, "");
        const arr = arrayPrefix ? getDeepValue(values as object, arrayPrefix) : values;

        if (Array.isArray(arr) && arr.length > 0) {
          for (let idx = 0; idx < arr.length; idx++) {
            nextPaths.push(`${p}${idx}.`);
          }
        }
      } else {
        nextPaths.push(`${p}${seg}.`);
      }
    }

    currentPaths = nextPaths;
  }

  return currentPaths.map((p) => p.replace(/\.$/, ""));
}

export function resolveWildcardDependency(
  dependencyPattern: string,
  concretePath: string,
  fieldPattern: string,
): string {
  if (!isWildcardPath(dependencyPattern) || !isWildcardPath(fieldPattern)) {
    return dependencyPattern;
  }

  const fieldRegexStr = fieldPattern
    .replace(/\./g, "\\.")
    .replace(/\*/g, "(\\d+)");
  const fieldRegex = new RegExp(`^${fieldRegexStr}$`);
  const match = concretePath.match(fieldRegex);

  if (!match) {
    return dependencyPattern;
  }

  const wildcardValues = match.slice(1);
  let valueIndex = 0;
  const segments = dependencyPattern.split("*");
  let result = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const val =
      valueIndex < wildcardValues.length ? wildcardValues[valueIndex++] : "*";
    result += val + segments[i];
  }

  return result;
}
