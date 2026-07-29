import type { Metadata } from "next";
import { AdminPanelPage } from "@/components/veronix/AdminPanelPage";

export const metadata: Metadata = {
  title: "لوحة التحكم",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AdminPanelPage />;
}
