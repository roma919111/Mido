import { redirect } from "next/navigation";

/** Legacy URL — device admin lives on the unified /admin console. */
export default function AdminIptvPage() {
  redirect("/admin?tab=player");
}
