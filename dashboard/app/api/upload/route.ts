import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";

// Vercel body size limit
export const config = {
  api: { bodyParser: false },
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Use os.tmpdir() for cross-platform compatibility (Windows + Vercel Linux)
    const tmpDir = os.tmpdir();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const tmpPath = path.join(tmpDir, `${Date.now()}_${safeName}`);

    await mkdir(tmpDir, { recursive: true }).catch(() => {});
    await writeFile(tmpPath, buffer);

    return NextResponse.json({ success: true, path: tmpPath, filename: file.name, size: buffer.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
