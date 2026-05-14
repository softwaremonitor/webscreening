import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, isPasswordValid } from "@/lib/auth";

const Body = z.object({ password: z.string().min(1).max(500) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "missing password" }, { status: 400 });
  }
  if (!isPasswordValid(parsed.data.password)) {
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }
  const session = await getAdminSession();
  session.isAdmin = true;
  session.loggedInAt = Date.now();
  await session.save();
  return NextResponse.json({ ok: true });
}
