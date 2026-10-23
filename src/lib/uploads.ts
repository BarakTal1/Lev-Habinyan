export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED = [
  /^image\/(jpeg|png|webp|heic|heif|gif)$/,
  /^application\/pdf$/,
  /^application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.ms-excel)$/,
  /^text\/(plain|csv)$/,
];

/** Throws when a file is too large or is not an image or a common document. */
export function validateUpload(file: { size: number; type: string }): void {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("file too large");
  if (!ALLOWED.some((re) => re.test(file.type))) throw new Error("file type not allowed");
}
