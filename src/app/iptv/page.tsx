import type { Metadata, Viewport } from "next";
import { IptvApp } from "@/components/iptv/IptvApp";
import "@/styles/max-show-iptv.css";

export const metadata: Metadata = {
  title: "Vyronix Max Media — IPTV",
  description: "Vyronix Max Media IPTV player",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050a1e",
};

export default function IptvPage() {
  return <IptvApp />;
}
