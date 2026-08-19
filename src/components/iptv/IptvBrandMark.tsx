export const IPTV_BRAND_NAME = "Vyronix Max Media Player";
export const IPTV_BRAND_LOGO = "/models/vyronix-icon-128.png?v=7";

export function IptvBrandMark() {
  return (
    <div className="mstv-rail__logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IPTV_BRAND_LOGO} alt="" className="mstv-rail__logo-img" />
      <div className="mstv-rail__brand">
        <strong>Vyronix</strong>
        <span>Max Media</span>
      </div>
    </div>
  );
}
