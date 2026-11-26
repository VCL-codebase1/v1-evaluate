import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { storeUpload } from "@/lib/uploads";

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That file is larger than 12 MB." }, { status: 400 });
  }

  try {
    const stored = await storeUpload(file);
    return NextResponse.json(stored, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload this file." },
      { status: 502 },
    );
  }
}
