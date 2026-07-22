import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  GitHubApiError,
  getGitHubConnection,
  githubRequestWithToken,
} from "@/lib/github";
import {
  type GitHubTreeEntry,
  createTemplateFolderFromGitHub,
  getImportableEntries,
  inferPlaygroundTemplate,
} from "@/lib/github-repository";

export const runtime = "nodejs";

type ImportRequest = {
  owner?: unknown;
  repo?: unknown;
  branch?: unknown;
};

type GitHubTree = {
  truncated: boolean;
  tree: GitHubTreeEntry[];
};

type GitHubContentFile = {
  type: "file";
  path: string;
  sha: string;
  encoding: "base64";
  content: string;
};

function getRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ImportRequest;
    const owner = getRequiredString(body.owner, "owner");
    const repo = getRequiredString(body.repo, "repo");
    const branch = getRequiredString(body.branch, "branch");
    const { userId, accessToken } = await getGitHubConnection();

    const tree = await githubRequestWithToken<GitHubTree>(
      accessToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );

    if (tree.truncated) {
      return NextResponse.json(
        { error: "This repository is too large to import in one request" },
        { status: 422 },
      );
    }

    const entries = getImportableEntries(tree.tree);
    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No text files were found to import" },
        { status: 422 },
      );
    }

    const files = (
      await mapWithConcurrency(entries, 5, async (entry) => {
        const file = await githubRequestWithToken<GitHubContentFile>(
          accessToken,
          `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${entry.path
            .split("/")
            .map(encodeURIComponent)
            .join("/")}?ref=${encodeURIComponent(branch)}`,
        );

        if (file.type !== "file" || file.encoding !== "base64") {
          return null;
        }

        const content = Buffer.from(
          file.content.replace(/\n/g, ""),
          "base64",
        ).toString("utf8");

        if (content.includes("\0")) {
          console.warn(`Skipping binary file: ${entry.path}`);
          return null;
        }

        return {
          path: file.path,
          sha: file.sha,
          content,
        };
      })
    ).filter(
      (
        file,
      ): file is {
        path: string;
        sha: string;
        content: string;
      } => file !== null,
    );

    const templateData = createTemplateFolderFromGitHub(
      owner,
      repo,
      branch,
      files,
    );

    const playground = await db.playground.create({
      data: {
        title: repo,
        description: `Imported from GitHub: ${owner}/${repo}`,
        template: inferPlaygroundTemplate(files.map((file) => file.path)),
        userId,
        templateFiles: {
          create: {
            content: JSON.stringify(templateData),
          },
        },
      },
      select: { id: true },
    });

    revalidatePath("/dashboard");

    return NextResponse.json({
      id: playground.id,
      importedFiles: files.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import repository" },
      { status: error instanceof GitHubApiError ? error.status : 500 },
    );
  }
}
