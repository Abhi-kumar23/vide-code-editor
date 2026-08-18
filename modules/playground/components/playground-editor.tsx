"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type Monaco } from "@monaco-editor/react";
import {
  registerCompletion,
  type CompletionRegistration,
} from "monacopilot";

import { TemplateFile } from "../lib/path-to-json";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  configureMonaco,
  defaultEditorOptions,
  getEditorLanguage,
  EDITOR_THEMES,
  type EditorThemeId,
  isEditorTheme,
} from "../lib/editor-config";

interface PlaygroundEditorProps {
  activeFile: TemplateFile | undefined;
  content: string;
  onContentChange: (value: string) => void;
  aiEnabled: boolean;
  suggestionLoading: boolean;
  onSuggestionLoadingChange: (value: boolean) => void;
}

export function PlaygroundEditor({
  activeFile,
  content,
  onContentChange,
  aiEnabled,
  suggestionLoading,
  onSuggestionLoadingChange,
}: PlaygroundEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const completionRef = useRef<CompletionRegistration | null>(null);
  const aiEnabledRef = useRef(aiEnabled);
  const [editorTheme, setEditorTheme] =
    useState<EditorThemeId>("modern-dark");

  useEffect(() => {
    aiEnabledRef.current = aiEnabled;

    if (!aiEnabled) {
      editorRef.current?.trigger(
        "ai",
        "editor.action.inlineSuggest.hide",
        null,
      );
    }
  }, [aiEnabled]);

  useEffect(() => {
    const savedTheme =
      window.localStorage.getItem("vide-editor-theme");

    if (isEditorTheme(savedTheme)) {
      setEditorTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "vide-editor-theme",
      editorTheme
    );

    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(editorTheme);
    }
  }, [editorTheme]);

  const handleEditorDidMount = useCallback(
    (editor: any, monaco: Monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      configureMonaco(monaco);
      monaco.editor.setTheme(editorTheme);

      editor.updateOptions({
        ...defaultEditorOptions,
        inlineSuggest: {
          enabled: true,
          mode: "prefix",
        },
        suggest: {
          preview: false,
        },
      });

      completionRef.current = registerCompletion(monaco, editor, {
        endpoint: "/api/code-completion",
        language: getEditorLanguage(activeFile?.fileExtension ?? ""),
        filename: activeFile?.filename,

        // Good default for a local model: wait until typing pauses.
        trigger: "onIdle",
        maxContextLines: 30,

        // Avoid a second automatic request after accepting a completion.
        allowFollowUpCompletions: false,

        // Keeps your existing AI toggle.
        triggerIf: () => aiEnabledRef.current,

        onCompletionRequested: () => onSuggestionLoadingChange(true),
        onCompletionRequestFinished: () => onSuggestionLoadingChange(false),
        onError: (error) => {
          onSuggestionLoadingChange(false);
          console.error("AI completion failed:", error);
        },
      });
    },
    [activeFile?.fileExtension, activeFile?.filename, onSuggestionLoadingChange, editorTheme,],
  );

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const language = getEditorLanguage(activeFile?.fileExtension ?? "");
    const model = editor.getModel();

    if (model) {
      monaco.editor.setModelLanguage(model, language);
    }

    completionRef.current?.updateOptions(() => ({
      language,
      filename: activeFile?.filename,
    }));
  }, [activeFile?.fileExtension, activeFile?.filename]);

  useEffect(() => {
    return () => {
      completionRef.current?.deregister();
      completionRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full">
      <div className="absolute right-2 top-2 z-10">
        <Select
          value={editorTheme}
          onValueChange={(value) =>
            setEditorTheme(value as EditorThemeId)
          }
        >
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Editor Theme" />
          </SelectTrigger>

          <SelectContent>
            {EDITOR_THEMES.map((theme) => (
              <SelectItem key={theme.id} value={theme.id}>
                {theme.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {suggestionLoading && (
        <div className="absolute right-2 top-2 z-10 rounded bg-red-100 px-2 py-1 text-xs text-red-700 dark:bg-red-900 dark:text-red-300">
          AI thinking…
        </div>
      )}

      <Editor
        height="100%"
        value={content}
        onChange={(value) => onContentChange(value ?? "")}
        onMount={handleEditorDidMount}
        language={
          activeFile
            ? getEditorLanguage(activeFile.fileExtension)
            : "plaintext"
        }
        options={defaultEditorOptions}
      />
    </div>
  );
}
