/**
 * Map BytePlus / Seedance provider errors to clear Arabic customer messages
 * while preserving the real reject reason.
 */

export function translateBytePlusError(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "فشل التوليد من BytePlus لسبب غير معروف.";

  const requestId =
    /Request id:\s*([a-zA-Z0-9]+)/i.exec(text)?.[1] ||
    /request[_ ]?id[=:\s]+([a-zA-Z0-9]+)/i.exec(text)?.[1] ||
    "";

  let reasonAr = "";
  if (/PrivacyInformation|real person|may contain real/i.test(text)) {
    reasonAr =
      "سبب الرفض من BytePlus: الصورة المرجعية قد تحتوي على شخص حقيقي (PrivacyInformation).";
  } else if (/InputImageSensitive|SensitiveContentDetected/i.test(text)) {
    reasonAr =
      "سبب الرفض من BytePlus: محتوى الصورة المرجعية حساس/مرفوض (InputImageSensitive).";
  } else if (/OutputVideoSensitive|OutputAudioSensitive|AudioSensitive/i.test(text)) {
    reasonAr =
      "سبب الرفض من BytePlus: ناتج الفيديو/الصوت اعتُبر حساسًا (OutputSensitive).";
  } else if (/expected the width to be at least\s*(\d+)/i.test(text)) {
    const m = /received a\s*(\d+)x(\d+)/i.exec(text);
    reasonAr = m
      ? `سبب الرفض من BytePlus: عرض الصورة أصغر من الحد الأدنى (استُلم ${m[1]}×${m[2]}px، المطلوب ≥300px).`
      : "سبب الرفض من BytePlus: أبعاد الصورة أصغر من الحد الأدنى (≥300px).";
  } else if (/InvalidParameter/i.test(text)) {
    reasonAr = `سبب الرفض من BytePlus: معامل غير صالح — ${text.slice(0, 180)}`;
  } else if (/timeout|timed out/i.test(text)) {
    reasonAr = "سبب الرفض من BytePlus: انتهت مهلة التوليد.";
  } else {
    reasonAr = `سبب الرفض من BytePlus: ${text.slice(0, 220)}`;
  }

  const parts = [reasonAr];
  if (/PrivacyInformation|real person|InputImageSensitive/i.test(text)) {
    parts.push(
      "تمت معالجة صور الشخصيات بفلتر AI الرقمي قبل الإرسال، ثم أُعيدت المحاولة تلقائيًا.",
    );
  }
  parts.push("تم استرجاع الكريديت.");
  if (requestId) parts.push(`رقم الطلب: ${requestId}`);
  return parts.join(" ");
}
