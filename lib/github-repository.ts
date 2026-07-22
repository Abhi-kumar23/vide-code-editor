import "server-only";

import path from "node:path";

import type {
  TemplateFile,
  TemplateFolder,
} from "@/modules/playground/lib/path-to-json";

export type GitHubTreeEntry = {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
};

export type ImportedGitHubFile = {
  path: string;
  sha: string;
  content: string;
};

export type PlaygroundTemplate =
  | "REACT"
  | "NEXTJS"
  | "EXPRESS"
  | "VUE"
  | "HONO"
  | "ANGULAR";

const MAX_FILE_SIZE = 512 * 1024;
const MAX_FILE_COUNT = 150;
const MAX_TOTAL_SIZE = 2 * 1024 * 1024;

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

const ignoredFileNames = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
]);

const binaryExtensions = new Set([
  "7z",
  "avi",
  "bmp",
  "class",
  "dll",
  "doc",
  "docx",
  "exe",
  "gif",
  "gz",
  "ico",
  "jar",
  "jpeg",
  "jpg",
  "mp3",
  "mp4",
  "mov",
  "otf",
  "pdf",
  "png",
  "so",
  "tar",
  "ttf",
  "wasm",
  "webm",
  "webp",
  "woff",
  "woff2",
  "xls",
  "xlsx",
  "zip",
]);

export function getImportableEntries(entries: GitHubTreeEntry[]) {
  const candidates = entries.filter((entry) => {
    if (entry.type !== "blob" || entry.size === undefined) return false;
    if (entry.size > MAX_FILE_SIZE) return false;

    const segments = entry.path.split("/");

    if (segments.some((segment) => ignoredDirectories.has(segment))) {
      return false;
    }

    const baseName = path.posix.basename(entry.path).toLowerCase();

    if (ignoredFileNames.has(baseName)) {
      return false;
    }

    const extension = path.posix.extname(entry.path).slice(1).toLowerCase();

    return !binaryExtensions.has(extension);
  });

  if (candidates.length > MAX_FILE_COUNT) {
    throw new Error(
      `This repository has ${candidates.length} importable files. Import repositories with ${MAX_FILE_COUNT} files or fewer.`,
    );
  }

  const totalSize = candidates.reduce((total, entry) => total + (entry.size ?? 0), 0);
  if (totalSize > MAX_TOTAL_SIZE) {
    throw new Error("This repository is too large to import into the browser editor.");
  }

  return candidates;
}

export function createTemplateFolderFromGitHub(
  owner: string,
  repo: string,
  branch: string,
  files: ImportedGitHubFile[],
): TemplateFolder {
  const root: TemplateFolder = {
    folderName: repo,
    github: { owner, repo, branch },
    items: [],
  };

  for (const file of files) {
    const segments = file.path.split("/");
    const fileName = segments.pop();
    if (!fileName) continue;

    let currentFolder = root;
    for (const folderName of segments) {
      let nextFolder = currentFolder.items.find(
        (item): item is TemplateFolder =>
          "folderName" in item && item.folderName === folderName,
      );

      if (!nextFolder) {
        nextFolder = { folderName, items: [] };
        currentFolder.items.push(nextFolder);
      }

      currentFolder = nextFolder;
    }

    const parsed = path.posix.parse(fileName);
    const templateFile: TemplateFile = {
      filename: parsed.name,
      fileExtension: parsed.ext.slice(1),
      content: file.content,
      github: { path: file.path, sha: file.sha },
    };

    currentFolder.items.push(templateFile);
  }

  return root;
}

export function inferPlaygroundTemplate(paths: string[]): PlaygroundTemplate {
  if (paths.some((filePath) => filePath === "next.config.js" || filePath === "next.config.ts")) {
    return "NEXTJS";
  }

  if (paths.some((filePath) => filePath.endsWith(".vue"))) return "VUE";
  if (paths.some((filePath) => filePath.includes("@angular/"))) return "ANGULAR";
  if (paths.some((filePath) => filePath.includes("hono"))) return "HONO";
  if (paths.some((filePath) => filePath.includes("express"))) return "EXPRESS";

  return "REACT";
}
