export type M3uChannel = {
  id: string;
  name: string;
  group?: string;
  logo?: string;
  url: string;
};

/** Minimal M3U/M3U8 parser for IPTV playlists. */
export function parseM3u(text: string): M3uChannel[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const channels: M3uChannel[] = [];
  let pending: Partial<M3uChannel> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF:")) {
      const nameMatch = line.match(/,(.+)$/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      pending = {
        name: nameMatch?.[1]?.trim() || "Channel",
        logo: logoMatch?.[1]?.trim() || undefined,
        group: groupMatch?.[1]?.trim() || undefined,
      };
      continue;
    }

    if (line.startsWith("#")) continue;

    if (pending) {
      channels.push({
        id: String(channels.length),
        name: pending.name || `Channel ${channels.length + 1}`,
        logo: pending.logo,
        group: pending.group,
        url: line,
      });
      pending = null;
    }
  }

  return channels;
}

export async function fetchAndParseM3u(m3uUrl: string): Promise<M3uChannel[]> {
  const res = await fetch(m3uUrl, {
    headers: { "User-Agent": "MAX-IPTV/1.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load playlist (${res.status})`);
  const text = await res.text();
  const channels = parseM3u(text);
  if (!channels.length) throw new Error("Playlist is empty");
  return channels;
}
