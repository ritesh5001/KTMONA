import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { normalizeTags } from "@/lib/cache-tags";

// Shared default so on-demand cache revalidation works out-of-the-box with no env setup.
// Must stay identical to the backend default in backend/src/live/revalidate.service.ts.
// Override via FRONTEND_REVALIDATE_SECRET (matching the backend) for stronger security.
const DEFAULT_REVALIDATE_SECRET =
  "48aba57348db9e7a3c077b11a97f511deaa9b6486e6b5a1950c1ffc2bb639557";

function getExpectedSecret(): string {
  return (
    process.env.FRONTEND_REVALIDATE_SECRET ??
    process.env.REVALIDATE_SECRET ??
    DEFAULT_REVALIDATE_SECRET
  );
}

export async function POST(request: NextRequest) {
  const expectedSecret = getExpectedSecret();
  const receivedSecret = request.headers.get("x-revalidate-secret");

  if (receivedSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const tags = normalizeTags((body as { tags?: unknown }).tags);

  for (const tag of tags) {
    revalidateTag(tag, "max");
  }

  return NextResponse.json({ ok: true, revalidatedTags: tags });
}
