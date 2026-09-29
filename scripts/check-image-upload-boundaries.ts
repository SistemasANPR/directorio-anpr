import assert from "node:assert/strict";
import {
  IMAGE_MAX_BYTES,
  decodeDataUrl,
  decodeImageDataUrl,
  isDataUrl,
  isImageDataUrl,
  isImageBytes,
  isImageTooLarge,
  isSupportedDocumentBytes,
} from "../shared/image-upload";

assert.equal(isImageTooLarge({ size: IMAGE_MAX_BYTES }), false, "exactly 2 MiB must be accepted");
assert.equal(isImageTooLarge({ size: IMAGE_MAX_BYTES + 1 }), true, "2 MiB + 1 must be rejected");
assert.equal(isImageBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
assert.equal(isImageBytes(Buffer.from("%PDF-1.7")), false);
assert.equal(isImageBytes(Buffer.from([0x42, 0x4d])), true, "BMP must be detected");
assert.equal(isImageBytes(Buffer.from([0x49, 0x49, 0x2a, 0x00])), true, "TIFF must be detected");
assert.equal(isImageBytes(Buffer.from([0, 0, 1, 0])), true, "ICO must be detected");
assert.equal(decodeImageDataUrl("DATA:IMAGE/PNG;base64,iVBORw0KGgo=").byteLength, 8);
assert.equal(decodeImageDataUrl("data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E").byteLength, 11);
assert.equal(isImageDataUrl("data:IMAGE/svg+xml;base64,PHN2Zz4="), true);
assert.equal(isImageDataUrl("\nDaTa:\tImAgE/svg+xml;base64,PHN2Zz4="), true);
assert.equal(isImageDataUrl("data: image/svg+xml;base64,PHN2Zz4="), true);
assert.equal(isImageDataUrl("\u0000data:image/svg+xml;base64,PHN2Zz4="), true);
assert.equal(decodeImageDataUrl("data: image/svg+xml;base64,PHN2Zz4=")?.byteLength, 5);
assert.equal(decodeImageDataUrl("\u0000data:image/svg+xml;base64,PHN2Zz4=")?.byteLength, 5);
const spoofedPng = Buffer.alloc(IMAGE_MAX_BYTES + 1);
Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(spoofedPng);
const spoofedPngUrl = `data:application/octet-stream;base64,${spoofedPng.toString("base64")}`;
const decodedSpoofedPng = decodeDataUrl(spoofedPngUrl);
assert.equal(isDataUrl(spoofedPngUrl), true);
assert.equal(decodedSpoofedPng !== null && isImageBytes(decodedSpoofedPng), true);
assert.equal(decodedSpoofedPng !== null && decodedSpoofedPng.byteLength > IMAGE_MAX_BYTES, true);
const parameterNamedBase64 = decodeDataUrl(
  "data:application/octet-stream;base64=1,%89PNG%0D%0A%1A%0A",
);
assert.equal(parameterNamedBase64 !== null && isImageBytes(parameterNamedBase64), true);
assert.equal(decodeImageDataUrl("data:image/svg+xml;base64,PHN2ZyUyMGZpbGw9JTIyJTIzZmZmJTIyJTNF").byteLength > 0, true);
assert.equal(decodeImageDataUrl("data:image/svg+xml,%3Csvg%3Eá%3C%2Fsvg%3E").byteLength, 13);
assert.equal(isImageBytes(Buffer.from(`<!--${"x".repeat(600)}--><svg></svg>`)), true);
assert.equal(isImageBytes(Buffer.from(`<!DOCTYPE svg [<!ENTITY test "value>still-in-subset">]><svg></svg>`)), true);
assert.equal(isImageBytes(Buffer.from("<svg></svg>", "utf16le")), true);
assert.equal(isSupportedDocumentBytes(Buffer.from("%PDF-1.7")), true);
assert.equal(isSupportedDocumentBytes(Buffer.from("<svg></svg>")), false);
console.log("Image size boundary and byte-signature checks passed.");