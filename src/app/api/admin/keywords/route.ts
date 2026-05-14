import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, guardAdmin } from "@/lib/apiErrors";
import { parseKeyword } from "@/lib/keywords";

const Create = z.object({
  text: z.string().min(1).max(200),
  enabled: z.boolean().default(true),
});

export async function GET() {
  const guard = await guardAdmin();
  if (guard) return guard;
  const items = await prisma.keyword.findMany({ orderBy: { text: "asc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const guard = await guardAdmin();
  if (guard) return guard;
  const body = await req.json().catch(() => null);
  const parsed = Create.safeParse(body);
  if (!parsed.success) return badRequest("invalid body", parsed.error.flatten());
  const pk = parseKeyword(parsed.data.text);
  try {
    const created = await prisma.keyword.create({
      data: { text: pk.raw, isPhrase: pk.isPhrase, enabled: parsed.data.enabled },
    });
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err) {
    return badRequest("could not create keyword", (err as Error).message);
  }
}
