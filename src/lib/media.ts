// Subida de fotos y vídeos: validación, compresión y subida a Storage.
// Genérico a propósito (recibe bucket y carpeta) para reutilizarlo en el
// form-check, donde la clienta subirá vídeos de su ejecución.

import type { SupabaseClient } from "@supabase/supabase-js";

export type MediaKind = "image" | "video";

/** Límites en bytes. El bucket los repite en el servidor (migración 0010). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB ya comprimida
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024;  // 30 MB
/** Tope del original antes de comprimir: evita reventar el canvas. */
export const MAX_RAW_IMAGE_BYTES = 25 * 1024 * 1024;

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1).replace(".", ",");

export function mediaKind(file: File): MediaKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

/**
 * Reduce una foto con canvas antes de subirla: una foto de móvil de 4 MB
 * suele quedar en 300-500 KB. Si no se puede decodificar (HEIC en algún
 * navegador) o no mejora, devuelve el original y decide el validador.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bitmap.close(); return file; }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

/**
 * Deja el fichero listo para subir: comprime la foto y comprueba el tamaño.
 * El vídeo no se puede comprimir en el navegador a coste cero, así que solo
 * se valida (mensaje claro antes de gastar datos subiendo).
 */
export async function prepareMedia(
  file: File,
): Promise<{ file: File; kind: MediaKind } | { error: string }> {
  const kind = mediaKind(file);
  if (!kind) return { error: "Solo puedes enviar fotos o vídeos." };

  if (kind === "video") {
    if (file.size > MAX_VIDEO_BYTES) {
      return {
        error: `El vídeo ocupa ${mb(file.size)} MB y el máximo son ${mb(MAX_VIDEO_BYTES)} MB. `
          + "Prueba con un vídeo más corto (menos de 30 segundos).",
      };
    }
    return { file, kind };
  }

  if (file.size > MAX_RAW_IMAGE_BYTES) {
    return { error: `La foto ocupa ${mb(file.size)} MB y es demasiado grande para procesarla.` };
  }
  const compressed = await compressImage(file);
  if (compressed.size > MAX_IMAGE_BYTES) {
    return {
      error: `La foto ocupa ${mb(compressed.size)} MB y el máximo son ${mb(MAX_IMAGE_BYTES)} MB.`,
    };
  }
  return { file: compressed, kind };
}

/** Sube a un bucket privado y devuelve la ruta guardada. */
export async function uploadMedia(
  sb: SupabaseClient,
  bucket: string,
  folder: string,
  file: File,
): Promise<{ path: string } | { error: string }> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type });
  if (error) {
    console.error(`[Media] No se pudo subir a ${bucket}:`, error);
    return { error: "No se pudo subir el archivo. Inténtalo de nuevo." };
  }
  return { path };
}
