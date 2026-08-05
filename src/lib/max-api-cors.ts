/** CORS for MAX APK calling activation API from Capacitor WebView. */
export const maxApiCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-max-admin-key, Authorization",
};

export function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(maxApiCors)) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}
