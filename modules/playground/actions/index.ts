"use server";

import { db } from "@/lib/db";
import { TemplateFolder } from "../lib/path-to-json";
import { currentUser } from "@/modules/auth/actions";





export const getPlaygroundById = async (id: string) => {
  const user = await currentUser();
  if (!user?.id) return null;

  return db.playground.findFirst({
    where: { id, userId: user.id },
    select: {
      title: true,
      templateFiles: { select: { content: true } },
    },
  });
};

export const SaveUpdatedCode = async (
  playgroundId: string,
  data: TemplateFolder,
) => {
  const user = await currentUser();
  if (!user?.id) throw new Error("Unauthorized");

  const playground = await db.playground.findFirst({
    where: { id: playgroundId, userId: user.id },
    select: { id: true },
  });
  if (!playground) throw new Error("Playground not found");

  return db.templateFile.upsert({
    where: { playgroundId },
    update: { content: JSON.stringify(data) },
    create: { playgroundId, content: JSON.stringify(data) },
  });
};