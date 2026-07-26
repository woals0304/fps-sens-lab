export function includesAnyKeyword(source: string, keywords: string[]): boolean {
  const lowered = source.toLowerCase();
  return keywords.some((keyword) => lowered.includes(keyword.toLowerCase()));
}
