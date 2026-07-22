import "server-only";

import { auth } from "@/auth";
import { db } from "@/lib/db";

const GITHUB_API = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export type GitHubConnection = {
  userId: string;
  accessToken: string;
};

export async function getGitHubConnection(): Promise<GitHubConnection> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new GitHubApiError("Sign in to connect a GitHub repository", 401);
  }

  const account = await db.account.findFirst({
    where: {
      userId,
      provider: "github",
    },
    select: {
      accessToken: true,
    },
  });

  if (!account?.accessToken) {
    throw new GitHubApiError(
      "Connect GitHub and grant repository access before importing a repository",
      403,
    );
  }

  return { userId, accessToken: account.accessToken };
}

export async function githubRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { accessToken } = await getGitHubConnection();
  return githubRequestWithToken<T>(accessToken, path, init);
}

export async function githubRequestWithToken<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {

  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "Vide-Code-Editor",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new GitHubApiError(
      error?.message ?? `GitHub error ${response.status}`,
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export function encodeGitHubPath(path: string) {
  const segments = path.split("/");

  if (
    !path ||
    segments.some(
      (segment) => !segment || segment === "." || segment === "..",
    )
  ) {
    throw new Error("Invalid file path");
  }

  return segments.map(encodeURIComponent).join("/");
}
