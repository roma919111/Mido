/**
 * Paste this into DevTools on https://dash.cloudflare.com while logged in as
 * maq9801@gmail.com (account 252c03a6…, live zone vyronix.app).
 *
 * Uploads vyronix-player-origin-router and attaches:
 *   vyronix.app/*
 *   www.vyronix.app/*
 *
 * Live MPEG-TS must pass through fetch() without rebuilding Response headers.
 */
(async () => {
  const ACCOUNT = "252c03a6bfb54804b6836e3c6e9bbc8f";
  const ZONE = "97064fe5630a76cac26be67507c5e770";
  const SCRIPT = "vyronix-player-origin-router";
  const STUDIO_ORIGIN = "https://mido-production-5cd6.up.railway.app";
  const PLAYER_ORIGIN = "https://maxmedia-production.up.railway.app";

  const worker = "/**\n * Same-hostname split: vyronix.app stays the public domain.\n * Player paths go to the Europe Railway origin; everything else stays on Mido (Singapore).\n *\n * Live MPEG-TS must be returned from fetch() as-is. Rebuilding Response with\n * hop-by-hop headers (Transfer-Encoding) makes Cloudflare emit 502 and the\n * player shows \"\u062a\u0639\u0630\u0651\u0631 \u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u0628\u062b\".\n */\n\nconst PLAYER_EXACT = new Set([\"/player\", \"/vyronixmaxmediaplayer\", \"/max\", \"/maxvyronixmerdia\", \"/maxvyronixmedia\", \"/maxvronixmedia\", \"/iptv\", \"/admin/iptv\", \"/api/iptv\"]);\n\nconst DROP_REQUEST_HEADERS = new Set([\n  \"host\",\n  \"connection\",\n  \"content-length\",\n  \"keep-alive\",\n  \"proxy-connection\",\n  \"transfer-encoding\",\n  \"te\",\n  \"trailer\",\n  \"upgrade\",\n  \"cf-connecting-ip\",\n  \"cf-ew-via\",\n  \"cf-ipcountry\",\n  \"cf-ray\",\n  \"cf-visitor\",\n  \"cdn-loop\",\n]);\n\nfunction pathnameOf(value) {\n  try {\n    if (!value) return \"\";\n    if (value.startsWith(\"http://\") || value.startsWith(\"https://\")) {\n      return new URL(value).pathname;\n    }\n    return value.startsWith(\"/\") ? value.split(\"?\")[0] : `/${value}`.split(\"?\")[0];\n  } catch {\n    return \"\";\n  }\n}\n\nfunction isPlayerPath(pathname) {\n  const path = pathname.split(\"?\")[0] || \"/\";\n  if (PLAYER_EXACT.has(path)) return true;\n  for (const prefix of PLAYER_EXACT) {\n    if (path.startsWith(`${prefix}/`)) return true;\n  }\n  return path.startsWith(\"/promo/max-media\");\n}\n\nfunction isPlayerAssetPath(pathname) {\n  return (\n    pathname.startsWith(\"/_next/\") ||\n    pathname.startsWith(\"/models/\") ||\n    pathname.startsWith(\"/promo/\") ||\n    pathname.startsWith(\"/icons/\")\n  );\n}\n\nfunction isStreamProxyPath(pathname) {\n  return pathname === \"/api/iptv/proxy\" || pathname.startsWith(\"/api/iptv/proxy/\");\n}\n\nfunction playerReferrer(request) {\n  const referer = pathnameOf(request.headers.get(\"Referer\") || \"\");\n  if (isPlayerPath(referer)) return true;\n  const nextUrl = pathnameOf(request.headers.get(\"Next-Url\") || \"\");\n  return isPlayerPath(nextUrl);\n}\n\nfunction pickOrigin(request, env) {\n  const url = new URL(request.url);\n  const path = url.pathname;\n  if (isPlayerPath(path)) return env.PLAYER_ORIGIN;\n  if (isPlayerAssetPath(path) && playerReferrer(request)) return env.PLAYER_ORIGIN;\n  return env.STUDIO_ORIGIN;\n}\n\nfunction buildHeaders(request, publicHost, pathname) {\n  const headers = new Headers();\n  for (const [key, value] of request.headers) {\n    if (DROP_REQUEST_HEADERS.has(key.toLowerCase())) continue;\n    headers.append(key, value);\n  }\n  headers.set(\"X-Forwarded-Host\", publicHost);\n  headers.set(\"X-Forwarded-Proto\", \"https\");\n  if (isStreamProxyPath(pathname)) {\n    headers.set(\"Accept-Encoding\", \"identity\");\n  }\n  return headers;\n}\n\nexport default {\n  async fetch(request, env) {\n    const studio = String(env.STUDIO_ORIGIN || \"\").replace(/\\/$/, \"\");\n    const player = String(env.PLAYER_ORIGIN || \"\").replace(/\\/$/, \"\");\n    if (!studio || !player) {\n      return new Response(\"Player origin router is missing STUDIO_ORIGIN or PLAYER_ORIGIN\", {\n        status: 500,\n      });\n    }\n\n    const publicUrl = new URL(request.url);\n    const origin = pickOrigin(request, { STUDIO_ORIGIN: studio, PLAYER_ORIGIN: player });\n    const target = new URL(publicUrl.pathname + publicUrl.search, origin);\n    const init = {\n      method: request.method,\n      headers: buildHeaders(request, publicUrl.host, publicUrl.pathname),\n      redirect: \"manual\",\n    };\n    if (request.method !== \"GET\" && request.method !== \"HEAD\") {\n      init.body = request.body;\n    }\n\n    return fetch(target, init);\n  },\n};\n")
  const meta = {
    main_module: "worker.js",
    compatibility_date: "2026-08-16",
    bindings: [
      { type: "plain_text", name: "STUDIO_ORIGIN", text: STUDIO_ORIGIN },
      { type: "plain_text", name: "PLAYER_ORIGIN", text: PLAYER_ORIGIN },
    ],
  };
  const fd = new FormData();
  fd.append("metadata", new File([JSON.stringify(meta)], "metadata.json", { type: "application/json" }));
  fd.append("worker.js", new File([worker], "worker.js", { type: "application/javascript+module" }));

  const put = await fetch(`/api/v4/accounts/${ACCOUNT}/workers/scripts/${SCRIPT}`, {
    method: "PUT",
    credentials: "include",
    body: fd,
  });
  const putJson = await put.json();
  if (!put.ok || putJson.success === false) {
    console.error("worker upload failed", put.status, putJson);
    return putJson;
  }

  const existing = await fetch(`/api/v4/zones/${ZONE}/workers/routes`, { credentials: "include" }).then((r) => r.json());
  const want = ["vyronix.app/*", "www.vyronix.app/*"];
  const have = new Set((existing.result || []).map((r) => r.pattern));
  const created = [];
  for (const pattern of want) {
    if (have.has(pattern)) continue;
    const res = await fetch(`/api/v4/zones/${ZONE}/workers/routes`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pattern, script: SCRIPT }),
    });
    created.push(await res.json());
  }

  const routes = await fetch(`/api/v4/zones/${ZONE}/workers/routes`, { credentials: "include" }).then((r) => r.json());
  console.log({ uploaded: true, created, routes: routes.result });
  return { uploaded: true, created, routes: routes.result };
})();
