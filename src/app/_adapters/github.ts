export const repositoryUrl = 'https://github.com/Bigelazo/u-roadmaps';

const repositoryApiUrl = 'https://api.github.com/repos/Bigelazo/u-roadmaps';
const oneWeekInSeconds = 60 * 60 * 24 * 7;
const requestTimeoutInMilliseconds = 3_000;

export async function readRepositoryStars(): Promise<number | null> {
  try {
    const response = await fetch(repositoryApiUrl, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: oneWeekInSeconds },
      signal: AbortSignal.timeout(requestTimeoutInMilliseconds),
    });
    if (!response.ok) return null;
    const repository: unknown = await response.json();
    return starCountOf(repository);
  } catch {
    return null;
  }
}

function starCountOf(repository: unknown): number | null {
  if (typeof repository !== 'object' || repository === null) return null;
  const stars = (repository as { stargazers_count?: unknown }).stargazers_count;
  return typeof stars === 'number' && Number.isInteger(stars) && stars >= 0 ? stars : null;
}
