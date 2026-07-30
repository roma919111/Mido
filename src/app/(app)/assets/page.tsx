import type { Metadata } from "next";
import { AssetsPage } from "@/components/veronix/AssetsPage";

export const metadata: Metadata = {
  title: "Assets",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AssetsPage />;
}
