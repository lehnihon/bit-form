export function mergePaths(
  previous?: readonly string[],
  next?: readonly string[],
): string[] | undefined {
  if ((!previous || previous.length === 0) && (!next || next.length === 0)) {
    return undefined;
  }

  const merged = new Set<string>(previous ?? []);
  next?.forEach((path) => merged.add(path));
  return Array.from(merged);
}
