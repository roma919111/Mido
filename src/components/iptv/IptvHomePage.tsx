"use client";

import { useEffect, useState } from "react";
import type { IptvChannel } from "@/lib/iptv-client";
import { fetchIptvHome, type IptvHomeDashboard } from "@/lib/iptv-client";
import { IptvChannelRow } from "./IptvChannelRow";

type IptvHomePageProps = {
  sessionId: string;
  deviceLabel?: string;
  onOpen: (ch: IptvChannel) => void;
  onLogout: () => void;
};

let homeMemory: { sessionId: string; data: IptvHomeDashboard } | null = null;

export function IptvHomePage({ sessionId, deviceLabel, onOpen, onLogout }: IptvHomePageProps) {
  const [data, setData] = useState<IptvHomeDashboard | null>(
    () => (homeMemory?.sessionId === sessionId ? homeMemory.data : null),
  );
  const [loading, setLoading] = useState(!homeMemory || homeMemory.sessionId !== sessionId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!(homeMemory?.sessionId === sessionId && homeMemory.data)) setLoading(true);
    setError(null);
    void (async () => {
      try {
        const home = await fetchIptvHome(sessionId);
        if (cancelled) return;
        homeMemory = { sessionId, data: home };
        setData(home);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "تعذّر تحميل الصفحة الرئيسية");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const days = data?.account.daysLeft;
  const daysLabel =
    days == null ? "—" : days < 0 ? "منتهي" : days === 0 ? "ينتهي اليوم" : `${days.toLocaleString("en-US")} يوم`;
  const matchGroups = (data?.matches ?? []).reduce<Array<{ league: string; items: NonNullable<typeof data>["matches"] }>>(
    (groups, match) => {
      const last = groups[groups.length - 1];
      if (last && last.league === match.channelName) last.items.push(match);
      else groups.push({ league: match.channelName, items: [match] });
      return groups;
    },
    [],
  );
  const hasChampions = (data?.matches ?? []).some((row) => row.channelName.includes("أبطال"));

  return (
    <div className="mstv-browse mstv-home">
      <header className="mstv-topbar mstv-topbar--simple">
        <h1 className="mstv-topbar__title">Vyronix Max Media</h1>
        <button type="button" className="mstv-topbar__sort" onClick={onLogout}>
          خروج · {deviceLabel}
        </button>
      </header>

      <section className="mstv-home__account">
        <div>
          <p className="mstv-home__kicker">الاشتراك</p>
          <h2>{data?.account.username ?? "…"}</h2>
          <p className="mstv-home__status">
            الحالة: <strong>{data?.account.statusLabel ?? "…"}</strong>
            {data?.account.isTrial ? <span className="mstv-home__chip">تجريبي</span> : null}
          </p>
        </div>
        <div className="mstv-home__account-meta">
          <div>
            <span>موعد الانتهاء</span>
            <strong>{data?.account.expLabel ?? "…"}</strong>
          </div>
          <div>
            <span>المتبقي</span>
            <strong>{loading ? "…" : daysLabel}</strong>
          </div>
          {data?.account.connections ? (
            <div>
              <span>الاتصالات</span>
              <strong>{data.account.connections}</strong>
            </div>
          ) : null}
        </div>
      </section>

      {error ? <p className="iptv-error">{error}</p> : null}
      {loading && !data ? <p className="mstv-empty">جاري تحميل الرئيسية…</p> : null}

      <section className="mstv-home__matches">
        <h2 className="mstv-row-section__title">مواعيد المباريات القادمة</h2>
        {!loading && !data?.matches.length ? (
          <p className="mstv-empty">لا توجد مباريات معلنة للدوري السعودي أو الإسباني أو الأبطال حالياً</p>
        ) : null}
        <div className="mstv-home__match-list">
          {matchGroups.map((group) => (
            <div key={group.league}>
              <h3 className="mstv-home__match-league">{group.league}</h3>
              {group.items.map((match) => (
                <button
                  key={match.id}
                  type="button"
                  className={`mstv-home__match${match.live ? " is-live" : ""}`}
                  onClick={() => {
                    if (match.channel) onOpen(match.channel);
                  }}
                >
                  <span className="mstv-home__match-logos">
                    {match.homeLogo || match.awayLogo ? (
                      <>
                        {match.homeLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={match.homeLogo} alt="" />
                        ) : null}
                        {match.awayLogo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={match.awayLogo} alt="" />
                        ) : null}
                      </>
                    ) : match.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={match.logo} alt="" />
                    ) : (
                      <span className="mstv-home__match-icon">⚽</span>
                    )}
                  </span>
                  <span className="mstv-home__match-body">
                    <strong>{match.title}</strong>
                    <small>{match.live ? "جارية الآن" : "توقيت السعودية"}</small>
                  </span>
                  <span className="mstv-home__match-time">
                    {match.live ? <em className="mstv-home__live">مباشر</em> : <em>{match.dayLabel}</em>}
                    <b>{match.timeLabel}</b>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
        {!loading && data?.matches.length && !hasChampions ? (
          <p className="mstv-empty">دوري أبطال أوروبا: لم تُعلن مباريات الموسم الجديد بعد</p>
        ) : null}
      </section>

      {data?.latestMovies.items.length ? (
        <IptvChannelRow title={`آخر الأفلام · ${data.latestMovies.title}`} items={data.latestMovies.items} onPlay={onOpen} />
      ) : null}
      {data?.latestSeries.items.length ? (
        <IptvChannelRow title={`آخر المسلسلات · ${data.latestSeries.title}`} items={data.latestSeries.items} onPlay={onOpen} />
      ) : null}
    </div>
  );
}
