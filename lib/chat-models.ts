export const chatModels = [
  { id: "qwen2.5-coder:3b", label: "Qwen 2.5 Coder · 3B" },
  { id: "qwen2.5-coder:7b", label: "Qwen 2.5 Coder · 7B" },
  { id: "deepseek-coder-v2:16b", label: "DeepSeek Coder V2 · 16B" },
] as const;

export type ChatModel = (typeof chatModels)[number]["id"];

export const defaultChatModel: ChatModel = "qwen2.5-coder:3b";

export function isChatModel(value: unknown): value is ChatModel {
  return (
    typeof value === "string" &&
    chatModels.some((model) => model.id === value)
  );
}