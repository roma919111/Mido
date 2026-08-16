import type { Metadata } from "next";
import { IptvApp } from "@/components/iptv/IptvApp";
import "@/styles/max-show-iptv.css";

export const metadata: Metadata = {
  title: "MAX SHOW TV — IPTV",
  description: "MAX SHOW TV IPTV player",
};

export default function IptvPage() {
  return <IptvApp />;
}
