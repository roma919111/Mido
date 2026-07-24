import { Workflow } from "lucide-react";

const WORKFLOWS = [
  {
    title: "Cinematic Hero Shot",
    steps: "Enhance prompt → Photorealistic preset → 16:9 → Generate Image",
  },
  {
    title: "Animate Portrait",
    steps: "Upload start frame → Image to Video → 5s → 1080p Pro",
  },
  {
    title: "Style Transfer Edit",
    steps: "Inpaint / Edit → Reference image → Cyberpunk preset → Generate",
  },
];

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/70">Pipelines</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white">Workflows</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {WORKFLOWS.map((flow) => (
          <article
            key={flow.title}
            className="rounded-3xl border border-white/8 bg-white/[0.02] p-5"
          >
            <Workflow className="h-5 w-5 text-cyan-300" />
            <h2 className="mt-4 text-lg font-semibold text-white">{flow.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/45">{flow.steps}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
