import type { IptvChannel } from "../lib/iptv-client";
import { channelRating, posterGradient } from "../lib/iptv-categories";
import { isFavorite, toggleFavorite } from "../lib/iptv-favorites";

type IptvMediaCardProps = {
  channel: IptvChannel;
  onPlay: (channel: IptvChannel) => void;
  onFavoriteChange: () => void;
};

export function IptvMediaCard({ channel, onPlay, onFavoriteChange }: IptvMediaCardProps) {
  const rating = channelRating(channel.id);
  const favorite = isFavorite(channel.id);

  function handleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    toggleFavorite(channel.id);
    onFavoriteChange();
  }

  return (
    <button type="button" className="max-show__card" onClick={() => onPlay(channel)}>
      <div className="max-show__poster" style={{ background: posterGradient(channel.id) }}>
        {channel.logo ? (
          <img src={channel.logo} alt="" className="max-show__poster-img" loading="lazy" />
        ) : (
          <span className="max-show__poster-fallback">{channel.name.slice(0, 1)}</span>
        )}
        <span className="max-show__rating">★ {rating.toFixed(1)}</span>
        <button
          type="button"
          className={`max-show__fav ${favorite ? "max-show__fav--on" : ""}`}
          aria-label={favorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
          onClick={handleFavorite}
        >
          {favorite ? "♥" : "♡"}
        </button>
      </div>
      <p className="max-show__card-title">{channel.name}</p>
    </button>
  );
}
