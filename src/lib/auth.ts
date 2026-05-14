import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export interface AdminSessionData {
  isAdmin?: boolean;
  loggedInAt?: number;
}

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters."
    );
  }
  return {
    cookieName: "packaging_news_admin",
    password,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 8, // 8h
      path: "/",
    },
  };
}

export async function getAdminSession() {
  const store = await cookies();
  return getIronSession<AdminSessionData>(store, sessionOptions());
}

export async function isAdmin(): Promise<boolean> {
  const session = await getAdminSession();
  return Boolean(session.isAdmin);
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    const err = new Error("Unauthorized");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
}

export function isPasswordValid(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ input.charCodeAt(i);
  }
  return mismatch === 0;
}
