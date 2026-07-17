import type { MessageAttachment, WireAttachment } from "@/domain/chat";

export const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const maxImageBytes = 5 * 1024 * 1024;

export function validateImageFile(file: File): string | undefined {
  if (!acceptedImageTypes.includes(file.type as (typeof acceptedImageTypes)[number])) {
    return "仅支持 JPG、PNG、WebP 或 GIF 图片。";
  }
  if (file.size > maxImageBytes) {
    return "图片不能超过 5 MB。";
  }
  return undefined;
}

export function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("无法读取图片。"));
    reader.readAsDataURL(blob);
  });
}

export async function toWireAttachment(attachment: MessageAttachment): Promise<WireAttachment> {
  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType as WireAttachment["mimeType"],
    size: attachment.size,
    dataUrl: await readBlobAsDataUrl(attachment.blob),
  };
}
