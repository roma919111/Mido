"use client";

import { LegalShell } from "@/components/veronix/LegalShell";
import { SocialLinks } from "@/components/veronix/SocialLinks";
import { useLocale } from "@/components/veronix/LocaleProvider";

export function AboutContent() {
  const { t } = useLocale();
  return (
    <LegalShell title={t.about.title}>
      <p>
        <strong className="text-white">Vyronix AI Studio</strong> {t.about.p1.replace(/^Vyronix AI Studio\s*/i, "")}
      </p>
      <p>{t.about.p2}</p>
      <h2 className="pt-2 text-base font-semibold text-white">
        {t.about.featuresTitle}
      </h2>
      <ul className="list-disc space-y-1 ps-5">
        {t.about.features.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2 className="pt-2 text-base font-semibold text-white">
        {t.about.contactTitle}
      </h2>
      <p>
        {t.contact.emailLabel}:{" "}
        <a className="text-[#22f0ff]" href="mailto:support@vyronix.app" dir="ltr">
          support@vyronix.app
        </a>
      </p>
      <p>
        {t.contact.siteLabel}:{" "}
        <a className="text-[#22f0ff]" href="https://vyronix.app" dir="ltr">
          https://vyronix.app
        </a>
      </p>
      <SocialLinks className="pt-2" />
    </LegalShell>
  );
}

export function FaqContent() {
  const { t } = useLocale();
  return (
    <LegalShell title={t.faq.title}>
      {t.faq.items.map((item) => (
        <div key={item.q} className="space-y-1">
          <h2 className="text-base font-semibold text-white">{item.q}</h2>
          <p>{item.a}</p>
        </div>
      ))}
    </LegalShell>
  );
}

export function ContactContent() {
  const { t } = useLocale();
  return (
    <LegalShell title={t.contact.title}>
      <p>{t.contact.p1}</p>
      <p>
        {t.contact.emailLabel}:{" "}
        <a className="text-[#22f0ff]" href="mailto:support@vyronix.app" dir="ltr">
          support@vyronix.app
        </a>
      </p>
      <p>
        {t.contact.siteLabel}:{" "}
        <a className="text-[#22f0ff]" href="https://vyronix.app" dir="ltr">
          https://vyronix.app
        </a>
      </p>
      <SocialLinks className="pt-4" />
    </LegalShell>
  );
}

export function PrivacyContent() {
  const { t } = useLocale();
  return (
    <LegalShell title={t.privacy.title}>
      {t.privacy.body.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </LegalShell>
  );
}

export function TermsContent() {
  const { t } = useLocale();
  return (
    <LegalShell title={t.terms.title}>
      {t.terms.body.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </LegalShell>
  );
}
