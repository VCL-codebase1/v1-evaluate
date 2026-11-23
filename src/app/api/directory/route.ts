import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api";
import { addDirectory, importDirectory, listDirectory, type DirectoryKind } from "@/lib/db/commercial";

function kindOf(value: string | null): DirectoryKind | null {
  return value === "client" || value === "supplier" ? value : null;
}

export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const kind = kindOf(new URL(request.url).searchParams.get("kind"));
  if (!kind) return NextResponse.json({ error: "Choose clients or suppliers." }, { status: 400 });
  try {
    return NextResponse.json({ records: await listDirectory(auth.session.organizationId, kind) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load records." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.session) return auth.response;
  const body = (await request.json().catch(() => null)) as {
    kind?: string;
    name?: string;
    contact?: string;
    email?: string;
    rows?: { name?: string; contact?: string; email?: string }[];
  } | null;
  const kind = kindOf(body?.kind ?? null);
  if (!kind) return NextResponse.json({ error: "Choose clients or suppliers." }, { status: 400 });
  try {
    if (Array.isArray(body?.rows)) {
      const records = await importDirectory(
        auth.session.organizationId,
        kind,
        body.rows.map((row) => ({
          name: String(row.name ?? ""),
          contact: String(row.contact ?? ""),
          email: String(row.email ?? ""),
        })),
      );
      return NextResponse.json({ records }, { status: 201 });
    }
    const name = body?.name?.trim() ?? "";
    if (!name) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
    const record = await addDirectory(auth.session.organizationId, kind, {
      name,
      contact: body?.contact?.trim() ?? "",
      email: body?.email?.trim() ?? "",
    });
    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save the record." }, { status: 500 });
  }
}
