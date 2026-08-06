import type { IptvChannel } from "../lib/iptv-client";
import type { IptvRow } from "../lib/iptv-categories";
import { IptvMediaCard } from "./IptvMediaCard";

type IptvMediaRowProps = {
  row: IptvRow;
  onPlay: (channel: IptvChannel) => void;
  onFavoriteChange: () => void;
};

export function IptvMediaRow({ row, onPlay, onFavoriteChange }: IptvMediaRowProps) {
  if (!row.channels.length) return null;

  return (
    <section className="max-show__row">
      <h2 className="max-show__row-title">{row.title}</h2>
      <div className="max-show__track">
        {row.channels.map((channel) => (
          <IptvMediaCard
            key={channel.id}
            channel={channel}
            onPlay={onPlay}
            onFavoriteChange={onFavoriteChange}
          />
        ))}
      </div>
    </section>
  );
}
