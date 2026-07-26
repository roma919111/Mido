import { redirect } from "next/navigation";

/** Image studio paused — send users to Veronix video. */
export default function CreateImagePage() {
  redirect("/create/video");
}
