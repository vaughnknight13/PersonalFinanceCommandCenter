// pluralize(1, 'transaction') -> "1 transaction", pluralize(3, 'transaction') -> "3 transactions"
export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}