import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { message: "ImageKit auth moved to backend (/v1/imagekit/auth)." },
    { status: 410 }
  );
}
