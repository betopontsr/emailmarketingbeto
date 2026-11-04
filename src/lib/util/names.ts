/** "JOHN" → "John", "mary-ann" → "Mary-Ann", "o'neil" → "O'Neil". */
export function properCase(name: string | null | undefined): string | null {
  const n = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!n || !/\p{L}/u.test(n)) return null;
  return n
    .toLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
