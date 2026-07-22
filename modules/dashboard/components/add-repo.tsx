"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, GitBranch, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type GitHubRepository = {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
};

type ApiError = { error?: string };

async function readResponseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ApiError;
  return body.error ?? "GitHub request failed";
}

const AddRepo = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepository, setSelectedRepository] =
    useState<GitHubRepository | null>(null);
  const [search, setSearch] = useState("");
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleRepositories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return repositories;

    return repositories.filter((repository) =>
      repository.fullName.toLowerCase().includes(query),
    );
  }, [repositories, search]);

  const openRepositoryPicker = async () => {
    setOpen(true);
    setError(null);

    if (repositories.length > 0 || isLoadingRepositories) return;

    setIsLoadingRepositories(true);
    try {
      const response = await fetch("/api/github/repos", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readResponseError(response));
      }

      const data = (await response.json()) as GitHubRepository[];
      setRepositories(data);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to load GitHub repositories";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoadingRepositories(false);
    }
  };

  const importRepository = async () => {
    if (!selectedRepository) return;

    setIsImporting(true);
    setError(null);

    try {
      const response = await fetch("/api/github/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: selectedRepository.owner,
          repo: selectedRepository.name,
          branch: selectedRepository.defaultBranch,
        }),
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response));
      }

      const data = (await response.json()) as {
        id: string;
        importedFiles: number;
      };

      toast.success(`Imported ${data.importedFiles} files from ${selectedRepository.fullName}`);
      router.push(`/playground/${data.id}`);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to import this repository";
      setError(message);
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openRepositoryPicker}
        className="group flex w-full cursor-pointer items-center justify-between rounded-lg border bg-muted px-6 py-6 text-left shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-all duration-300 ease-in-out hover:scale-[1.02] hover:border-[#E93F3F] hover:bg-background hover:shadow-[0_10px_30px_rgba(233,63,63,0.15)]"
      >
        <span className="flex items-start gap-4">
          <span className="flex size-10 items-center justify-center rounded-md border bg-white transition-colors duration-300 group-hover:border-[#E93F3F] group-hover:bg-[#fff8f8] group-hover:text-[#E93F3F]">
            <ArrowDown
              size={30}
              className="transition-transform duration-300 group-hover:translate-y-1"
            />
          </span>

          <span>
            <span className="block text-xl font-bold text-[#E93F3F]">
              Open GitHub Repository
            </span>
            <span className="mt-1 block max-w-56 text-sm text-muted-foreground">
              Import a repository into a new code playground
            </span>
          </span>
        </span>

        <Image
          src="/github.svg"
          alt=""
          width={150}
          height={150}
          className="transition-transform duration-300 group-hover:scale-110"
        />
      </button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!isImporting) setOpen(nextOpen);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="size-5" /> Open a GitHub repository
            </DialogTitle>
            <DialogDescription>
              Choose a repository to import into a new playground. Large and binary files are skipped.
            </DialogDescription>
          </DialogHeader>

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search repositories"
            disabled={isLoadingRepositories || isImporting}
          />

          <div className="max-h-80 overflow-y-auto rounded-md border">
            {isLoadingRepositories ? (
              <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading repositories…
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-destructive">{error}</div>
            ) : visibleRepositories.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No repositories found.
              </div>
            ) : (
              <div className="divide-y">
                {visibleRepositories.map((repository) => {
                  const selected = selectedRepository?.id === repository.id;

                  return (
                    <button
                      key={repository.id}
                      type="button"
                      onClick={() => setSelectedRepository(repository)}
                      className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted ${
                        selected ? "bg-muted" : ""
                      }`}
                    >
                      <span>
                        <span className="block font-medium">{repository.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          Default branch: {repository.defaultBranch}
                        </span>
                      </span>
                      {repository.private && (
                        <Lock className="size-4 text-muted-foreground" aria-label="Private repository" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter showCloseButton>
            <Button
              onClick={importRepository}
              disabled={!selectedRepository || isImporting || isLoadingRepositories}
            >
              {isImporting && <Loader2 className="size-4 animate-spin" />}
              {isImporting ? "Importing…" : "Import repository"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddRepo;
