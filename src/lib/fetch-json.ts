/**
 * Parse fetch responses safely.
 * Tunnel/proxy outages often return HTML (Cloudflare 502 pages) which
 * makes res.json() throw "Unexpected token '<'".
 */
export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ res: Response; data: T }> {
  const res = await fetch(input, init);
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  const looksLikeHtml =
    text.trimStart().startsWith("<!") ||
    text.trimStart().startsWith("<html") ||
    contentType.includes("text/html");

  if (looksLikeHtml) {
    const isBadGateway = res.status === 502 || /bad gateway|502/i.test(text);
    throw new Error(
      isBadGateway
        ? "الخادم المؤقت (النفق) رجع خطأ 502. حدّث الصفحة وحاول مرة ثانية."
        : `السيرفر رجّع صفحة HTML بدل JSON (HTTP ${res.status}). حدّث الصفحة وحاول مرة ثانية.`,
    );
  }

  if (!text.trim()) {
    throw new Error(`Empty response from server (HTTP ${res.status})`);
  }

  try {
    return { res, data: JSON.parse(text) as T };
  } catch {
    throw new Error(
      `Invalid JSON from server (HTTP ${res.status}): ${text.slice(0, 160)}`,
    );
  }
}
