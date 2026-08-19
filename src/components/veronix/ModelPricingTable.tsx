"use client";

import {
  CREDITS_PER_USD,
  CREDIT_USD,
  calculateVideoCredits,
  listVideoModelPricing,
  type VideoQuality,
} from "@/config/modelPricing";
import { PIXVERSE_MODEL_ID } from "@/lib/pixverse-constants";
import { MINIMAX_H3_MODEL_ID } from "@/lib/minimax-constants";
import { ModelLogo } from "@/components/veronix/ModelLogo";
import { VIDEO_MODELS } from "@/lib/model-catalog";

const PIXVERSE_QUALITIES: VideoQuality[] = ["360p", "540p", "720p", "1080p"];
const MINIMAX_QUALITIES: VideoQuality[] = ["768p", "2k"];

export function ModelPricingTable() {
  const models = listVideoModelPricing();

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-bold">تسعير التوليد بالكريدت</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/55">
        معيار المحفظة:{" "}
        <span className="text-[#22f0ff]" dir="ltr">
          $1 = {CREDITS_PER_USD.toLocaleString("en-US")} credits
        </span>{" "}
        · 1 credit = ${CREDIT_USD.toFixed(3)} USD. يُحسب الفيديو:{" "}
        <span dir="ltr">Math.ceil(creditsPerSecond × duration)</span>.
      </p>

      <div className="mt-6 space-y-6">
        {models.map((model) => (
          <div
            key={model.modelId}
            className="overflow-hidden rounded-3xl border border-white/10 bg-[#141821]"
          >
            <div className="border-b border-white/8 px-5 py-4">
              <p className="text-sm text-white/45">Video model</p>
              <div className="mt-1 flex items-center gap-2.5">
                {model.modelId === MINIMAX_H3_MODEL_ID ? (
                  <ModelLogo
                    model={
                      VIDEO_MODELS.find((m) => m.id === MINIMAX_H3_MODEL_ID) ?? {
                        id: MINIMAX_H3_MODEL_ID,
                        name: model.displayName,
                        mcpId: MINIMAX_H3_MODEL_ID,
                      }
                    }
                    size={26}
                  />
                ) : null}
                <p className="font-display text-lg font-semibold">{model.displayName}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left text-white/45">
                    <th className="px-5 py-3 font-medium">Quality</th>
                    {model.modelId === MINIMAX_H3_MODEL_ID ? (
                      <th className="px-5 py-3 font-medium">Credits/sec</th>
                    ) : model.modelId === PIXVERSE_MODEL_ID ? (
                      <>
                        <th className="px-5 py-3 font-medium">بدون صوت</th>
                        <th className="px-5 py-3 font-medium">مع صوت</th>
                        <th className="px-5 py-3 font-medium">مرجع فيديو</th>
                        <th className="px-5 py-3 font-medium">مرجع + صوت</th>
                      </>
                    ) : (
                      <>
                        <th className="px-5 py-3 font-medium">No audio</th>
                        <th className="px-5 py-3 font-medium">With audio</th>
                      </>
                    )}
                    <th className="px-5 py-3 font-medium">5s example</th>
                  </tr>
                </thead>
                <tbody>
                  {(model.modelId === PIXVERSE_MODEL_ID
                    ? PIXVERSE_QUALITIES
                    : model.modelId === MINIMAX_H3_MODEL_ID
                      ? MINIMAX_QUALITIES
                      : (Object.keys(model.creditsPerSecond) as VideoQuality[])
                  ).map((quality) => {
                    const tier = model.creditsPerSecond[quality];
                    if (!tier) return null;
                    const fusion = model.videoReferenceCreditsPerSecond?.[quality];
                    const example = calculateVideoCredits({
                      model: model.modelId,
                      quality,
                      hasAudio: false,
                      durationInSeconds: 5,
                    });
                    return (
                      <tr key={quality} className="border-b border-white/5 last:border-0">
                        <td className="px-5 py-3 font-medium text-white" dir="ltr">
                          {quality}
                        </td>
                        {model.modelId === MINIMAX_H3_MODEL_ID ? (
                          <td className="px-5 py-3 tabular-nums text-[#22f0ff]" dir="ltr">
                            {tier.noAudio}/sec
                          </td>
                        ) : model.modelId === PIXVERSE_MODEL_ID ? (
                          <>
                            <td className="px-5 py-3 tabular-nums text-[#22f0ff]" dir="ltr">
                              {tier.noAudio}/ث
                            </td>
                            <td className="px-5 py-3 tabular-nums text-[#22f0ff]" dir="ltr">
                              {tier.withAudio}/ث
                            </td>
                            <td className="px-5 py-3 tabular-nums text-[#f0c14a]" dir="ltr">
                              {fusion?.noAudio ?? "—"}/ث
                            </td>
                            <td className="px-5 py-3 tabular-nums text-[#f0c14a]" dir="ltr">
                              {fusion?.withAudio ?? "—"}/ث
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-5 py-3 tabular-nums text-[#22f0ff]" dir="ltr">
                              {tier.noAudio}/sec
                            </td>
                            <td className="px-5 py-3 tabular-nums text-[#22f0ff]" dir="ltr">
                              {tier.withAudio}/sec
                            </td>
                          </>
                        )}
                        <td className="px-5 py-3 tabular-nums text-white/70" dir="ltr">
                          {example.toLocaleString("en-US")} credits
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {model.modelId === MINIMAX_H3_MODEL_ID ? (
              <p className="border-t border-white/8 px-5 py-3 text-xs text-white/40">
                Input: first 5 reference images free · extra images $0.04 each (×
                markup) · reference video billed at output rate per second.
              </p>
            ) : null}
            {model.videoReferenceCreditsPerSecond ? (
              <p className="border-t border-white/8 px-5 py-3 text-xs text-white/40">
                Fusion / فيديو مرجعي: جدول PixVerse الرسمي (~ضعف السعر) × $10/2000 نقطة × هامش 55%.
              </p>
            ) : model.videoReferenceExtraPerSecond ? (
              <p className="border-t border-white/8 px-5 py-3 text-xs text-white/40">
                Fusion (video reference): extra surcharge per second by quality — see
                studio estimate when reference videos are attached.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
