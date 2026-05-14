import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/apiErrors";

export async function GET() {
  const guard = await guardAdmin();
  if (guard) return guard;
  const items = await prisma.batchRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
    include: {
      errors: {
        include: { source: { select: { id: true, name: true, homepageUrl: true } } },
      },
    },
  });
  return NextResponse.json({ items });
}
