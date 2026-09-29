export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const IMAGE_TOO_LARGE_MESSAGE =
  "La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera.";

export function isImageMimeType(mimeType: string | undefined): boolean {
  return Boolean(mimeType?.toLowerCase().startsWith("image/"));
}

export function isImageTooLarge(file: { size: number }): boolean {
  return file.size > IMAGE_MAX_BYTES;
}

function normalizeDataUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Match the URL parser's preprocessing: remove leading/trailing C0 controls
  // and spaces, and ignore tabs/newlines. The data-URL MIME parser also
  // tolerates ASCII whitespace immediately after "data:".
  const cleaned = value
    .replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, "")
    .replace(/[\t\r\n]/g, "");
  if (!/^data:/i.test(cleaned)) return null;
  return cleaned.replace(/^data:\s*/i, "data:");
}

export function isDataUrl(value: unknown): boolean {
  return normalizeDataUrl(value) !== null;
}

export function isImageDataUrl(value: unknown): boolean {
  const normalized = normalizeDataUrl(value);
  return normalized !== null && /^data:image\//i.test(normalized);
}

export function findOversizedImage<T extends { size: number; type?: string }>(
  files: Iterable<T>,
): T | undefined {
  return Array.from(files).find(
    (file) => isImageMimeType(file.type) && isImageTooLarge(file),
  );
}

/** Detect common image formats from bytes, not a browser supplied MIME type. */
export function isImageBytes(bytes: Uint8Array): boolean {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return true;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes.length >= 6) {
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
    if (header === "GIF87a" || header === "GIF89a") return true;
  }
  if (bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP") return true;
  // BMP, ICO and TIFF
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return true;
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return true;
  if (bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0) ||
     (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && bytes[3] === 0x2a))) return true;
  // ISO-BMFF images: AVIF/HEIF/HEIC identify themselves in the ftyp box.
  if (bytes.length >= 12 && String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === "ftyp") {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    if (["avif", "avis", "heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return true;
  }
  // SVG permits XML declarations, comments and a doctype before the root
  // element. Walk only those legal preamble nodes so "<svg" in PDF metadata
  // cannot turn an otherwise valid document into an image.
  const isUtf16Le = bytes.length >= 2 &&
    (bytes[0] === 0xff && bytes[1] === 0xfe || bytes[0] === 0x3c && bytes[1] === 0);
  const isUtf16Be = bytes.length >= 2 &&
    (bytes[0] === 0xfe && bytes[1] === 0xff || bytes[0] === 0 && bytes[1] === 0x3c);
  const encoding = isUtf16Le ? "utf-16le" : isUtf16Be ? "utf-16be" : "utf-8";
  let text = new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/, "").trimStart();
  while (text.startsWith("<?") || text.startsWith("<!--") || /^<!doctype\b/i.test(text)) {
    let end = -1;
    let terminatorLength = 1;
    if (text.startsWith("<?")) {
      end = text.indexOf("?>");
      terminatorLength = 2;
    } else if (text.startsWith("<!--")) {
      end = text.indexOf("-->");
      terminatorLength = 3;
    } else {
      let subsetDepth = 0;
      let quote = "";
      for (let index = 9; index < text.length; index++) {
        const char = text[index];
        if (quote) {
          if (char === quote) quote = "";
        } else if (char === '"' || char === "'") {
          quote = char;
        } else if (char === "[") {
          subsetDepth++;
        } else if (char === "]") {
          subsetDepth = Math.max(0, subsetDepth - 1);
        } else if (char === ">" && subsetDepth === 0) {
          end = index;
          break;
        }
      }
    }
    if (end === -1) return false;
    text = text.slice(end + terminatorLength).trimStart();
  }
  return /^<svg(?:\s|>)/i.test(text);
}

/** Detect the document formats that are intentionally allowed above 2 MiB. */
export function isSupportedDocumentBytes(bytes: Uint8Array): boolean {
  if (bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
    bytes[3] === 0x46 && bytes[4] === 0x2d) return true; // PDF
  if (bytes.length >= 8 &&
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 && bytes[5] === 0xb1 && bytes[6] === 0x1a && bytes[7] === 0xe1) return true; // .doc/OLE
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08)); // .docx/ZIP
}

/** Returns decoded bytes for a standards-normalized inline data URL. */
export function decodeDataUrl(value: unknown): Uint8Array | null {
  const normalized = normalizeDataUrl(value);
  if (normalized === null) return null;
  const match = /^data:[^,]*,([\s\S]*)$/i.exec(normalized);
  if (!match) return null;
  const metadata = normalized.slice(0, normalized.indexOf(",")).toLowerCase();
  try {
    const usesBase64 = metadata
      .split(";")
      .slice(1)
      .some((token) => token.trim().toLowerCase() === "base64");
    if (usesBase64) {
      // Percent escapes are legal in a data URL payload, including around
      // base64 characters such as "+" and "=".
      const encoded = decodeURIComponent(match[1]).replace(/\s/g, "");
      const decoded = atob(encoded);
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
      return bytes;
    }

    // Percent escapes represent raw bytes, while unescaped Unicode characters
    // must be counted using their real UTF-8 representation.
    const bytes: number[] = [];
    for (let index = 0; index < match[1].length;) {
      const current = match[1][index];
      if (current === "%") {
        const hex = match[1].slice(index + 1, index + 3);
        if (!/^[0-9a-f]{2}$/i.test(hex)) return null;
        bytes.push(parseInt(hex, 16));
        index += 3;
        continue;
      }
      const codePoint = match[1].codePointAt(index);
      if (codePoint === undefined) return null;
      const encoded = new TextEncoder().encode(String.fromCodePoint(codePoint));
      for (let byteIndex = 0; byteIndex < encoded.length; byteIndex++) {
        bytes.push(encoded[byteIndex]);
      }
      index += codePoint > 0xffff ? 2 : 1;
    }
    return Uint8Array.from(bytes);
  } catch {
    return null;
  }
}

/** Returns decoded bytes only when the declared data-URL MIME is image/*. */
export function decodeImageDataUrl(value: unknown): Uint8Array | null {
  return isImageDataUrl(value) ? decodeDataUrl(value) : null;
}