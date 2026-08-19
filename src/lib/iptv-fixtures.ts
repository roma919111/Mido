const ESPN_TZ = "Asia/Riyadh";
const FIXTURE_CACHE_MS = 15 * 60 * 1000;
const UPCOMING_DAYS = 16;

type EspnTeam = {
  displayName?: string;
  shortDisplayName?: string;
  logo?: string;
};

type EspnCompetitor = {
  homeAway?: string;
  team?: EspnTeam;
};

type EspnEvent = {
  id?: string;
  date?: string;
  name?: string;
  shortName?: string;
  competitions?: Array<{
    date?: string;
    status?: { type?: { state?: string; completed?: boolean } };
    competitors?: EspnCompetitor[];
  }>;
};

export type SoccerLeagueSlug = "ksa.1" | "esp.1" | "uefa.champions" | "eng.1";

export type IptvSoccerLeague = {
  slug: SoccerLeagueSlug;
  label: string;
  channelHints: string[];
};

export const IPTV_SOCCER_LEAGUES: IptvSoccerLeague[] = [
  { slug: "ksa.1", label: "الدوري السعودي", channelHints: ["SSC", "شاهين", "KSA", "SAUDI", "SPL"] },
  { slug: "esp.1", label: "الدوري الإسباني", channelHints: ["LALIGA", "LA LIGA", "BEIN"] },
  { slug: "uefa.champions", label: "دوري أبطال أوروبا", channelHints: ["UCL", "CHAMPIONS", "أبطال", "BEIN"] },
  { slug: "eng.1", label: "الدوري الإنجليزي", channelHints: ["PREMIER", "EPL", "BEIN"] },
];

export type IptvFixture = {
  id: string;
  league: string;
  leagueSlug: SoccerLeagueSlug;
  homeName: string;
  awayName: string;
  homeLogo: string | null;
  awayLogo: string | null;
  startAt: number;
  live: boolean;
};

type FixtureCache = { at: number; items: IptvFixture[] };

const fixtureCache: FixtureCache = { at: 0, items: [] };

const TEAM_AR: Record<string, string> = {
  "al hilal": "الهلال",
  "al nassr": "النصر",
  "al ittihad": "الاتحاد",
  "al ahli": "الأهلي",
  "al shabab": "الشباب",
  "al ettifaq": "الاتفاق",
  "al fateh": "الفتح",
  "al taawoun": "التعاون",
  "al fayha": "الفيحاء",
  "al qadsiah": "القادسية",
  "al kholood": "الخلود",
  "al riyadh": "الرياض",
  "al hazem": "الحزم",
  "al okhdood": "أخدود",
  "al khaleej": "الخليج",
  damac: "ضمك",
  "al wehda": "الوحدة",
  "al raed": "الرائد",
  "neom sc": "نيوم",
  neom: "نيوم",
  "al-faisaly": "الفيصلي",
  "al faisaly": "الفيصلي",
  abha: "أبها",
  "al diriyah": "الدرعية",
  "real madrid": "ريال مدريد",
  barcelona: "برشلونة",
  "atletico madrid": "أتلتيكو مدريد",
  sevilla: "إشبيلية",
  valencia: "فالنسيا",
  villarreal: "فياريال",
  "real sociedad": "ريال سوسيداد",
  "athletic club": "أتلتيك بلباو",
  "real betis": "ريال بيتيس",
  girona: "جيرونا",
  osasuna: "أوساسونا",
  "celta vigo": "سيلتا فيغو",
  mallorca: "مايوركا",
  getafe: "خيتافي",
  "rayo vallecano": "رايو فاليكانو",
  alaves: "ألافيس",
  "deportivo alaves": "ألافيس",
  deportivo: "ديبورتيفو",
  "racing santander": "راسينغ سانتاندر",
  malaga: "مالقة",
  espanyol: "إسبانيول",
  levante: "ليفانتي",
  elche: "إلتشي",
  "manchester city": "مانشستر سيتي",
  "manchester united": "مانشستر يونايتد",
  liverpool: "ليفربول",
  chelsea: "تشيلسي",
  arsenal: "أرسنال",
  tottenham: "توتنهام",
  "tottenham hotspur": "توتنهام",
  "newcastle united": "نيوكاسل",
  "aston villa": "أستون فيلا",
  "afc bournemouth": "بورنموث",
  brentford: "برينتفورد",
  "brighton hove albion": "برايتون",
  "coventry city": "كوفنتري",
  "crystal palace": "كريستال بالاس",
  everton: "إيفرتون",
  fulham: "فولهام",
  "hull city": "هال سيتي",
  "ipswich town": "إيبسويتش",
  "leeds united": "ليدز يونايتد",
  "nottingham forest": "نوتينغهام فورست",
  sunderland: "سندرلاند",
  "bayern munich": "بايرن ميونخ",
  "borussia dortmund": "دورتموند",
  "internazionale": "إنتر ميلان",
  inter: "إنتر ميلان",
  "ac milan": "ميلان",
  juventus: "يوفنتوس",
  napoli: "نابولي",
  "paris saint-germain": "باريس سان جيرمان",
  psg: "باريس سان جيرمان",
};

function ymd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function upcomingRange(): string {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + UPCOMING_DAYS);
  return `${ymd(start)}-${ymd(end)}`;
}

function foldName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function arabicTeam(name: string): string {
  const key = foldName(name);
  return TEAM_AR[key] ?? name.trim();
}

function competitorBy(competitors: EspnCompetitor[] | undefined, side: "home" | "away"): EspnCompetitor | undefined {
  return competitors?.find((row) => row.homeAway === side) ?? (side === "home" ? competitors?.[0] : competitors?.[1]);
}

function parseEvent(league: IptvSoccerLeague, event: EspnEvent): IptvFixture | null {
  const competition = event.competitions?.[0];
  const iso = competition?.date || event.date;
  const startAt = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(startAt)) return null;
  const state = competition?.status?.type?.state ?? "pre";
  const completed = competition?.status?.type?.completed === true || state === "post";
  const live = state === "in";
  if (completed && !live) return null;
  const now = Date.now();
  if (!live && startAt < now - 20 * 60 * 1000) return null;
  if (startAt > now + UPCOMING_DAYS * 86400000) return null;

  const home = competitorBy(competition?.competitors, "home");
  const away = competitorBy(competition?.competitors, "away");
  const homeName = arabicTeam(home?.team?.displayName || "فريق");
  const awayName = arabicTeam(away?.team?.displayName || "فريق");

  return {
    id: `${league.slug}-${event.id || startAt}`,
    league: league.label,
    leagueSlug: league.slug,
    homeName,
    awayName,
    homeLogo: home?.team?.logo || null,
    awayLogo: away?.team?.logo || null,
    startAt,
    live,
  };
}

async function fetchLeagueScoreboard(league: IptvSoccerLeague, dates: string): Promise<IptvFixture[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league.slug}/scoreboard?dates=${dates}&limit=100`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; VyronixMaxMedia/1.0)",
    },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { events?: EspnEvent[] };
  return (data.events ?? []).flatMap((event) => {
    const row = parseEvent(league, event);
    return row ? [row] : [];
  });
}

export async function fetchUpcomingSoccerFixtures(): Promise<IptvFixture[]> {
  if (Date.now() - fixtureCache.at < FIXTURE_CACHE_MS && fixtureCache.items.length) {
    return fixtureCache.items;
  }
  const dates = upcomingRange();
  const batches = await Promise.all(
    IPTV_SOCCER_LEAGUES.map((league) => fetchLeagueScoreboard(league, dates).catch(() => [] as IptvFixture[])),
  );
  const seen = new Set<string>();
  const items = batches
    .flat()
    .filter((row) => {
      const key = `${row.leagueSlug}:${row.homeName}:${row.awayName}:${row.startAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      if (a.live !== b.live) return a.live ? -1 : 1;
      return a.startAt - b.startAt;
    });
  fixtureCache.at = Date.now();
  fixtureCache.items = items;
  return items;
}

export function formatKickoffDay(ms: number): string {
  return new Intl.DateTimeFormat("ar-GB", {
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone: ESPN_TZ,
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(new Date(ms));
}

export function formatKickoffTime(ms: number): string {
  return new Intl.DateTimeFormat("ar-GB", {
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone: ESPN_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(ms));
}

type NamedChannel = { name: string };

export function pickFixtureChannel<T extends NamedChannel>(channels: T[], fixture: IptvFixture, league: IptvSoccerLeague | undefined): T | null {
  if (!channels.length) return null;
  const home = fixture.homeName.toUpperCase();
  const away = fixture.awayName.toUpperCase();
  const teamHit = channels.find((ch) => {
    const n = ch.name.toUpperCase();
    return n.includes(home) || n.includes(away) || n.includes(fixture.homeName) || n.includes(fixture.awayName);
  });
  if (teamHit) return teamHit;
  const hints = league?.channelHints ?? [];
  const hintHit = channels.find((ch) => {
    const n = ch.name.toUpperCase();
    return hints.some((hint) => n.includes(hint.toUpperCase()));
  });
  if (hintHit) return hintHit;
  return channels.find((ch) => /BEIN|بي ان|SSC|SPORT|رياض/.test(ch.name.toUpperCase())) ?? channels[0] ?? null;
}
