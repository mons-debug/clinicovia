"use client";

import { useLocaleStore } from "@/stores/locale-store";
import { locales, type Locale } from "@/lib/i18n";

const labels: Record<Locale, string> = {
  fr: "Français",
  en: "English",
  ar: "العربية",
};

export function LocaleSwitcher() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
      aria-label="Language"
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {labels[l]}
        </option>
      ))}
    </select>
  );
}
