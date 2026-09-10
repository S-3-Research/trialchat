import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const devPassword = process.env.DEV_PASSWORD;

  if (!devPassword) {
    return NextResponse.json(
      { success: false, error: "Dev password not configured" },
      { status: 500 }
    );
  }

  if (password === devPassword) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { success: false, error: "Incorrect password" },
    { status: 401 }
  );
}
