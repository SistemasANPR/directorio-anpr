import {
  IMAGE_MAX_BYTES,
  IMAGE_TOO_LARGE_MESSAGE,
  findOversizedImage,
} from "@shared/image-upload";

const NOTICE_ATTRIBUTE = "data-image-size-notice";

function acceptsImages(input: HTMLInputElement): boolean {
  return input.type === "file" && input.accept.toLowerCase().includes("image");
}

function addVisibleNotice(input: HTMLInputElement): void {
  if (!acceptsImages(input) || input.dataset.imageSizeGuarded) return;

  input.dataset.imageSizeGuarded = "true";
  input.title = `${input.title ? `${input.title} · ` : ""}Tamaño máximo por imagen: 2 MB`;
  input.setAttribute("aria-label", `${input.getAttribute("aria-label") || "Seleccionar archivo"}. Tamaño máximo por imagen: 2 MB`);

  const notice = document.createElement("small");
  notice.setAttribute(NOTICE_ATTRIBUTE, "");
  notice.className = "block mt-1 text-xs text-gray-500";
  notice.textContent = "Tamaño máximo por imagen: 2 MB";
  input.insertAdjacentElement("afterend", notice);
}

function scanImageInputs(root: ParentNode = document): void {
  root.querySelectorAll<HTMLInputElement>('input[type="file"][accept*="image" i]')
    .forEach(addVisibleNotice);
}

function rejectOversizedImages(
  files: Iterable<{ size: number; type?: string }>,
): boolean {
  if (!findOversizedImage(files)) return false;
  window.alert(IMAGE_TOO_LARGE_MESSAGE);
  return true;
}

/**
 * Installs a capture-phase guard so oversized images are stopped before any
 * React onChange/drop callback can create a preview or append them to FormData.
 */
export function installImageUploadGuard(): () => void {
  const handleChange = (event: Event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files) return;

    // Size is authoritative. MIME is used only to avoid applying the image
    // limit to document/catalog inputs that intentionally have larger limits.
    const filesToCheck = acceptsImages(input)
      ? Array.from(input.files).map((file) => ({ ...file, size: file.size, type: "image/known-input" }))
      : Array.from(input.files);

    if (rejectOversizedImages(filesToCheck)) {
      input.value = "";
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  const handleDrop = (event: DragEvent) => {
    if (event.dataTransfer?.files && rejectOversizedImages(Array.from(event.dataTransfer.files))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  scanImageInputs();
  const observer = new MutationObserver(() => scanImageInputs());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("change", handleChange, true);
  document.addEventListener("drop", handleDrop, true);

  return () => {
    observer.disconnect();
    document.removeEventListener("change", handleChange, true);
    document.removeEventListener("drop", handleDrop, true);
    document.querySelectorAll(`[${NOTICE_ATTRIBUTE}]`).forEach((node) => node.remove());
  };
}

export { IMAGE_MAX_BYTES, IMAGE_TOO_LARGE_MESSAGE };