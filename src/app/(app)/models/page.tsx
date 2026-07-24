import { Boxes } from "lucide-react";

const MODELS = [
  {
    name: "Nano Banana 2 Lite",
    media: "Image",
    desc: "Fast, cost-efficient text-to-image and image-to-image.",
  },
  {
    name: "PixVerse V6",
    media: "Video",
    desc: "Text-to-video and image-to-video with 720p / 1080p controls.",
  },
  {
    name: "OpenArt MCP Router",
    media: "Orchestration",
    desc: "Routes Studio AI jobs through https://mcp.openart.ai/mcp.",
  },
];

export default function ModelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300/70">Model Hub</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl text-white">Models</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {MODELS.map((model) => (
          <article
            key={model.name}
            className="rounded-3xl border border-white/8 bg-white/[0.02] p-5"
          >
            <Boxes className="h-5 w-5 text-cyan-300" />
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/35">{model.media}</p>
            <h2 className="mt-2 text-lg font-semibold text-white">{model.name}</h2>
            <p className="mt-2 text-sm text-white/45">{model.desc}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
