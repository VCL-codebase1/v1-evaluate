import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { readLocalUpload } from "@/lib/uploads";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;

  const { id } = await context.params;
  const file = await readLocalUpload(id);
  if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `inline; filename="${file.name}"`,
    },
  });
}
