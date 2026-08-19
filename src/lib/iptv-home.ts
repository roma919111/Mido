import {
  fetchUpcomingSoccerFixtures,
  formatKickoffDay,
  formatKickoffTime,
  IPTV_SOCCER_LEAGUES,
  pickFixtureChannel,
} from "@/lib/iptv-fixtures";
import { formatGregorianAr } from "@/lib/iptv-device-fields";
import { liveCategoryMatchScore } from "@/lib/iptv-live-default";
import { getIptvSession, mapChannelForClient } from "@/lib/iptv-session-cache";
import {
  fetchXtreamLiveByCategory,
  fetchXtreamLiveCategories,
  fetchXtreamMoviesByCategory,
  fetchXtreamSeriesByCategory,
  fetchXtreamSeriesCategories,
  fetchXtreamVodCategories,
  verifyXtreamLogin,
  type XtreamAccountInfo,
} from "@/lib/xtream-url";

type HomeChannel = ReturnType<typeof mapChannelForClient>;

export type IptvAccountCard = {
  username: string;
  status: string;
  statusLabel: string;
  expDate: string | null;
  expLabel: string;
  daysLeft: number | null;
  isTrial: boolean;
  connections: string | null;
};

export type IptvMatchItem = {
  id: string;
  title: string;
  channelName: string;
  startAt: number;
  timeLabel: string;
  dayLabel: string;
  logo: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
  live: boolean;
  channel: HomeChannel | null;
};

export type IptvHomeDashboard = {
  account: IptvAccountCard;
  latestMovies: { title: string; items: HomeChannel[] };
  latestSeries: { title: string; items: HomeChannel[] };
  matches: IptvMatchItem[];
};

const HOME_CACHE_MS = 3 * 60 * 1000;
const homeCache = new Map<string, { at: number; data: IptvHomeDashboard }>();

export function mapXtreamAccount(info: XtreamAccountInfo, fallbackUsername: string): IptvAccountCard {
  const user = info.user_info ?? {};
  const username = user.username?.trim() || fallbackUsername;
  const status = (user.status ?? "Unknown").toString();
  const statusLabel =
    status.toLowerCase() === "active" ? "نشط" : status.toLowerCase() === "expired" ? "منتهي" : status;
  const expRaw = user.exp_date?.toString() ?? "";
  const expMs = /^\d+$/.test(expRaw) ? Number(expRaw) * 1000 : Date.parse(expRaw);
  const hasExpiry = Number.isFinite(expMs) && expMs > 0;
  const daysLeft = hasExpiry ? Math.ceil((expMs - Date.now()) / 86400000) : null;
  const isTrial = String(user.is_trial ?? "") === "1";
  const max = user.max_connections != null ? String(user.max_connections) : null;
  const active = user.active_cons != null ? String(user.active_cons) : null;

  return {
    username,
    status,
    statusLabel,
    expDate: hasExpiry ? new Date(expMs).toISOString() : null,
    expLabel: hasExpiry ? formatGregorianAr(expMs) : "غير محدد",
    daysLeft,
    isTrial,
    connections: max ? `${active ?? "0"} / ${max}` : null,
  };
}

function sportScore(name: string): number {
  const preferred = liveCategoryMatchScore(name);
  if (preferred === 0) return -1;
  const n = name.toUpperCase();
  if (/مبار|TODAY|اليوم|EVENTS|EVENT/.test(n)) return 0;
  if (preferred < 99) return preferred;
  if (/SPORT|رياض|كرة|NBA|UFC|ALKASS|الكاس/.test(n)) return 6;
  return 99;
}

function pickLatestCategory<T extends { name: string }>(rows: T[]): T | undefined {
  return [...rows].sort((a, b) => {
    const pa = a.name.toUpperCase().includes("2026") ? 0 : a.name.toUpperCase().includes("2025") ? 1 : 10;
    const pb = b.name.toUpperCase().includes("2026") ? 0 : b.name.toUpperCase().includes("2025") ? 1 : 10;
    return pa - pb;
  })[0];
}

export async function buildIptvHomeDashboard(sessionId: string): Promise<IptvHomeDashboard> {
  const session = getIptvSession(sessionId);
  if (!session) throw new Error("Session expired");

  const cached = homeCache.get(sessionId);
  if (cached && Date.now() - cached.at < HOME_CACHE_MS) return cached.data;

  const creds = session.creds;

  const [accountInfo, vodCats, seriesCats, liveCats, fixtures] = await Promise.all([
    session.accountInfo
      ? Promise.resolve(session.accountInfo)
      : verifyXtreamLogin(creds).catch(() => ({} as XtreamAccountInfo)),
    session.vodCategories
      ? Promise.resolve(session.vodCategories)
      : fetchXtreamVodCategories(creds),
    session.seriesCategories
      ? Promise.resolve(session.seriesCategories)
      : fetchXtreamSeriesCategories(creds),
    session.liveCategoryMeta
      ? Promise.resolve(session.liveCategoryMeta)
      : fetchXtreamLiveCategories(creds).catch(() => []),
    fetchUpcomingSoccerFixtures().catch(() => []),
  ]);

  if (accountInfo?.user_info) session.accountInfo = accountInfo;
  if (!session.vodCategories) session.vodCategories = vodCats;
  if (!session.seriesCategories) session.seriesCategories = seriesCats;
  if (!session.liveCategoryMeta) session.liveCategoryMeta = liveCats;

  const account = mapXtreamAccount(accountInfo, creds.username);
  const movieCat = pickLatestCategory(vodCats);
  const seriesCat = pickLatestCategory(seriesCats);
  const sportCats = liveCats
    .map((cat) => ({ cat, score: sportScore(cat.name) }))
    .filter((row) => row.score < 99)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((row) => row.cat);

  const [moviesRaw, seriesRaw, ...sportBatches] = await Promise.all([
    movieCat ? fetchXtreamMoviesByCategory(creds, movieCat.id) : Promise.resolve([]),
    seriesCat ? fetchXtreamSeriesByCategory(creds, seriesCat.id) : Promise.resolve([]),
    ...sportCats.map((cat) => fetchXtreamLiveByCategory(creds, cat.id, cat.name).catch(() => [])),
  ]);

  const movies = moviesRaw.slice(0, 16).map((ch) => mapChannelForClient(session, ch));
  const series = seriesRaw.slice(0, 16).map((ch) => mapChannelForClient(session, ch));
  sportCats.forEach((cat, index) => {
    const batch = sportBatches[index];
    if (batch?.length) session.liveByCategory.set(cat.id, batch);
  });
  const sportChannels = sportBatches.flat();

  const leagueBySlug = new Map(IPTV_SOCCER_LEAGUES.map((row) => [row.slug, row]));
  const selected = IPTV_SOCCER_LEAGUES.flatMap((league) =>
    fixtures.filter((row) => row.leagueSlug === league.slug).slice(0, 8),
  );

  const matches: IptvMatchItem[] = selected.map((fixture) => {
    const league = leagueBySlug.get(fixture.leagueSlug);
    const rawChannel = pickFixtureChannel(sportChannels, fixture, league);
    return {
      id: fixture.id,
      title: `${fixture.homeName} ضد ${fixture.awayName}`,
      channelName: fixture.league,
      startAt: fixture.startAt,
      timeLabel: fixture.live ? "مباشر" : formatKickoffTime(fixture.startAt),
      dayLabel: fixture.live ? "الآن" : formatKickoffDay(fixture.startAt),
      logo: fixture.homeLogo,
      homeLogo: fixture.homeLogo,
      awayLogo: fixture.awayLogo,
      live: fixture.live,
      channel: rawChannel ? mapChannelForClient(session, rawChannel) : null,
    };
  });

  const data: IptvHomeDashboard = {
    account,
    latestMovies: { title: movieCat?.name || "آخر الأفلام", items: movies },
    latestSeries: { title: seriesCat?.name || "آخر المسلسلات", items: series },
    matches,
  };
  homeCache.set(sessionId, { at: Date.now(), data });
  return data;
}
