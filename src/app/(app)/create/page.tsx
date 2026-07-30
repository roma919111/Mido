import { redirect } from "next/navigation";

/** Legacy /create → video studio (BottomNav opens the picker). */
export default function CreateIndexPage() {
  redirect("/create/video");
}
