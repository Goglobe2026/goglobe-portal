export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Keeps the JSON database file fast and reliable — large PDFs stored as
// base64 would bloat every read/write of the collection they live in.
export const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4MB
