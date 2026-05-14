import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";

export async function guardAdmin(): Promise<NextResponse | null> {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

export function notFound(message = "not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}
