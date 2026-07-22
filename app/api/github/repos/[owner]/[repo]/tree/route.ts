import { NextRequest, NextResponse } from "next/server";
import { GitHubApiError, githubRequest } from "@/lib/github";

export const runtime = "nodejs";

type GitTree = {
    truncated: boolean;
    tree: Array<{
        path: string;
        type: "blob" | "tree";
        sha: string;
        size?: number;
    }>;
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ owner: string; repo: string }> },
) {
    try {
        const { owner, repo } = await params;
        const ref = request.nextUrl.searchParams.get("ref") ?? "HEAD";

        const data = await githubRequest<GitTree>(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
        );

        if (data.truncated) {
            return NextResponse.json(
                { error: "Repository is too large to import in one request" },
                { status: 422 },
            );
        }

        const ignoredFolders = [
            "node_modules/",
            ".git/",
            "__MACOSX/",
        ];

        const ignoredFiles = [
            ".DS_Store",
            "Thumbs.db",
        ];

        const files = data.tree.filter((entry) => {
            if (entry.type !== "blob") return false;

            if (entry.size === undefined || entry.size > 1_000_000)
                return false;

            if (
                ignoredFolders.some(folder =>
                    entry.path.startsWith(folder)
                )
            ) {
                return false;
            }

            if (
                ignoredFiles.some(file =>
                    entry.path.endsWith(file)
                )
            ) {
                return false;
            }

            return true;
        });

        return NextResponse.json({ files });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unable to load tree" },
            { status: error instanceof GitHubApiError ? error.status : 500 },
        );
    }
}
