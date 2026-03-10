export async function copyTextWithFallback(value: string): Promise<boolean> {
  if (!value) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

export async function generateQrDataUrl(value: string): Promise<string> {
  const qrCodeModule = await import("qrcode");
  const toDataUrl = qrCodeModule.toDataURL ?? qrCodeModule.default?.toDataURL;

  if (!toDataUrl) {
    throw new Error("QR generation is not available.");
  }

  return toDataUrl(value, {
    width: 300,
    margin: 1,
    color: {
      dark: "rgb(17 17 17)",
      light: "rgb(255 255 255)",
    },
  });
}
