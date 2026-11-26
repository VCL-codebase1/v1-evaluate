import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type StoredUpload = {
  url: string;
  name: string;
  provider: "cloudinary" | "local";
};

const UPLOAD_DIR = join(process.cwd(), "uploads");

function cloudinaryConfig() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim() || "",
    apiKey: process.env.CLOUDINARY_API_KEY?.trim() || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET?.trim() || "",
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET?.trim() || "",
  };
}

async function uploadToCloudinary(file: File): Promise<StoredUpload | null> {
  const { cloudName, apiKey, apiSecret, uploadPreset } = cloudinaryConfig();
  if (!cloudName) return null;

  const body = new FormData();
  body.set("file", file);
  body.set("folder", "v11-estimate");

  if (uploadPreset) {
    body.set("upload_preset", uploadPreset);
  } else if (apiKey && apiSecret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `folder=v11-estimate&timestamp=${timestamp}${apiSecret}`;
    body.set("api_key", apiKey);
    body.set("timestamp", String(timestamp));
    body.set("signature", createHash("sha1").update(toSign).digest("hex"));
  } else {
    return null;
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body,
  });
  const payload = (await response.json().catch(() => null)) as { secure_url?: string; url?: string; error?: { message?: string } } | null;
  const url = payload?.secure_url || payload?.url;
  if (!response.ok || !url) {
    throw new Error(payload?.error?.message || "Cloudinary could not store this file.");
  }
  return { url, name: file.name, provider: "cloudinary" };
}

async function uploadLocally(file: File): Promise<StoredUpload> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const id = `${randomUUID()}${extension}`;
  await writeFile(join(UPLOAD_DIR, id), Buffer.from(await file.arrayBuffer()));
  return { url: `/api/uploads/${id}`, name: file.name, provider: "local" };
}

export async function storeUpload(file: File): Promise<StoredUpload> {
  try {
    const cloud = await uploadToCloudinary(file);
    if (cloud) return cloud;
  } catch (error) {
    if (!cloudinaryConfig().cloudName) throw error;
  }
  return uploadLocally(file);
}

export async function readLocalUpload(id: string) {
  const safe = id.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safe || safe !== id) return null;
  try {
    return { bytes: await readFile(join(UPLOAD_DIR, safe)), name: safe };
  } catch {
    return null;
  }
}
