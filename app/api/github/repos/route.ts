import { NextResponse } from "next/server";
import { GitHubApiError, githubRequest } from "@/lib/github";

export const runtime = "nodejs";

type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  owner: { login: string };
  updated_at: string;
};

export async function GET() {
  try {
    const repos = await githubRequest<GitHubRepo[]>(
      "/user/repos?affiliation=owner,collaborator&sort=updated&per_page=100",
    );

    return NextResponse.json(
      repos.map((repo) => ({
        id: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at,
      })),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to list repos" },
      { status: error instanceof GitHubApiError ? error.status : 500 },
    );
  }
}
