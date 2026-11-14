/** ['a'] → "a" · ['a', 'b'] → "a y b" · ['a', 'b', 'c'] → "a, b y c" */
export function joinWithAnd(items: readonly string[]): string {
  const labels = [...items];
  const last = labels.pop();
  if (last === undefined) return '';
  return labels.length === 0 ? last : `${labels.join(', ')} y ${last}`;
}
