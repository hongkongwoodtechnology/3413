export function shouldStartMatchesLoading(existingMatchCount: number): boolean {
  return existingMatchCount === 0;
}

export function shouldShowMatchesLoading(
  isLoading: boolean,
  matchCount: number
): boolean {
  return isLoading && matchCount === 0;
}
