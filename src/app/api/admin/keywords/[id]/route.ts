import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, guardAdmin, notFound } from "@/lib/apiErrors";
import { parseKeyword } from "@/lib/keywords";

const Update = z.object({
  text: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardAdmin();
  if (guard) return guard;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = Update.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());
  const data: { text?: string; isPhrase?: boolean; enabled?: boolean } = {};
  if (parsed.data.text !== undefined) {
    const pk = parseKeyword(parsed.data.text);
    data.text = pk.raw;
    data.isPhrase = pk.isPhrase;
  }
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  try {
    const updated = await prisma.keyword.update({ where: { id }, data });
    return NextResponse.json({ item: updated });
  } catch (err) {
    return notFound((err as Error).message);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardAdmin();
  if (guard) return guard;
  const { id } = await ctx.params;
  try {
    await prisma.keyword.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return notFound((err as Error).message);
  }
}
