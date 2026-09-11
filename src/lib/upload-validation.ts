import path from "path";

/**
 * Allowed file extensions for uploads served from /public.
 * Only safe, non-executable formats are permitted.
 */
const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".pdf",
  ".doc", ".docx",
  ".xls", ".xlsx",
  ".csv", ".txt",
  ".zip",
]);

/**
 * Allowed image extensions (subset for image-only upload endpoints).
 */
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
]);

/**
 * Validates that a filename has a safe, allowed extension.
 * Returns the normalized (lowercase) extension if valid, or null if rejected.
 */
export function validateFileExtension(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return null;
  }
  return ext;
}

/**
 * Validates that a filename has a safe image extension.
 * Returns the normalized (lowercase) extension if valid, or null if rejected.
 */
export function validateImageExtension(filename: string): string | null {
  const ext = path.extname(filename).toLowerCase();
  if (!ext || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return null;
  }
  return ext;
}
