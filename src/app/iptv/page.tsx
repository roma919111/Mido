import type { Metadata } from "next";
import { IptvApp } from "@/components/iptv/IptvApp";

export const metadata: Metadata = {
  title: "MAX IPTV — Host Login",
  description: "IPTV player with Xtream host, username, and password",
};

export default function IptvPage() {
  return <IptvApp />;
}
