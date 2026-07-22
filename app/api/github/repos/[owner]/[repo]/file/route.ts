import { NextRequest, NextResponse } from "next/server";
import {
  GitHubApiError,
  encodeGitHubPath,
  githubRequest,
} from "@/lib/github";

export const runtime = "nodejs";

type SaveFileRequest = {
  path: string;
  content: string;
  branch: string;
  sha?: string;
  message: string;
};

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> },
) {
  try {
    const { owner, repo } = await params;
    const body = (await request.json()) as SaveFileRequest;

    if (!body.path || !body.branch || !body.content || !body.message) {
      return NextResponse.json(
        { error: "path, content, branch, and message are required" },
        { status: 400 },
      );
    }

    const result = await githubRequest(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(body.path)}`,
      {
        method: "PUT",
        body: JSON.stringify({
          message: body.message || `Update ${body.path} from Vide`,
          content: Buffer.from(body.content, "utf8").toString("base64"),
          branch: body.branch,
          ...(body.sha ? { sha: body.sha } : {}),
        }),
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save file";

    return NextResponse.json(
      { error: message },
      { status: error instanceof GitHubApiError ? error.status : 500 },
    );
  }
}
