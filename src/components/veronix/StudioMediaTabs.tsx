"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/veronix/LocaleProvider";

type StudioTab = "video" | "image" | "edit";

const TAB_HREF: Record<StudioTab, string> = {
  video: "/create/video",
  image: "/create/image",
  edit: "/edit",
};

/** Main studio tabs: Video · Image · Editing — used in create + edit shells. */
export function StudioMediaTabs({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const { t, dir } = useLocale();

  const active: StudioTab = pathname.startsWith("/edit")
    ? "edit"
    : pathname.startsWith("/create/image")
      ? "image"
      : pathname.startsWith("/create/video") || pathname === "/"
        ? "video"
        : "video";

  const tabs: { id: StudioTab; label: string; href: string }[] = [
    { id: "video", label: t.create.mediaVideo, href: TAB_HREF.video },
    { id: "image", label: t.create.mediaImage, href: TAB_HREF.image },
    { id: "edit", label: t.editStudio.tab, href: TAB_HREF.edit },
  ];

  return (
    <div
      className={`flex flex-wrap gap-2 ${className}`}
      dir={dir}
      role="tablist"
      aria-label={t.editStudio.tabList}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-white text-black"
                : "border border-white/10 text-white/70 hover:border-white/25 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
