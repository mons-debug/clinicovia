import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

export type Locale = "fr" | "en" | "ar";

export const locales: Locale[] = ["fr", "en", "ar"];
export const defaultLocale: Locale = "fr";

export const messageBundles: Record<Locale, Record<string, unknown>> = {
  fr,
  en,
  ar,
};

export function isRtl(locale: Locale): boolean {
  return locale === "ar";
}

export function getMessages(locale: Locale) {
  return messageBundles[locale] ?? messageBundles[defaultLocale];
}
