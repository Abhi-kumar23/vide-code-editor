import { NextRequest, NextResponse } from "next/server";

import {
  GitHubApiError,
  encodeGitHubPath,
  githubRequest,
} from "@/lib/github";

export const runtime = "nodejs";

type GitHubContentFile = {
  type: "file";
  path: string;
  sha: string;
  encoding: "base64";
  content: string;
  size: number;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string; path: string[] }> },
) {
  try {
    const { owner, repo, path } = await params;
    const filePath = path.join("/");

    const ignoredFiles = [
      ".DS_Store",
      "Thumbs.db",
    ];

    const binaryExtensions = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".ico",
      ".webp",
      ".woff",
      ".woff2",
      ".ttf",
      ".eot",
      ".pdf",
      ".zip",
      ".gz",
      ".tar",
      ".mp3",
      ".mp4",
      ".mov",
    ];

    if (
      ignoredFiles.some(file => filePath.endsWith(file)) ||
      binaryExtensions.some(ext => filePath.endsWith(ext))
    ) {
      return NextResponse.json(
        {
          skipped: true,
        },
        { status: 204 }
      );
    }
    
    const ref = request.nextUrl.searchParams.get("ref") ?? "HEAD";

    const file = await githubRequest<GitHubContentFile>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(filePath)}?ref=${encodeURIComponent(ref)}`,
    );

    if (file.type !== "file" || file.encoding !== "base64") {
      return NextResponse.json(
        { error: "Only base64-encoded text files can be opened" },
        { status: 422 },
      );
    }

    const content = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString(
      "utf8",
    );

    if (content.includes("\0")) {
      return NextResponse.json(
        { error: "Binary files cannot be opened in the code editor" },
        { status: 422 },
      );
    }

    return NextResponse.json({
      path: file.path,
      sha: file.sha,
      content,
      size: file.size,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open file" },
      { status: error instanceof GitHubApiError ? error.status : 500 },
    );
  }
}
