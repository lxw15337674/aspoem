import en from "./messages/en.json";
import ja from "./messages/ja.json";
import ko from "./messages/ko.json";
import zhHans from "./messages/zh-Hans.json";
import zhHant from "./messages/zh-Hant.json";

export const locales = ["zh-Hans", "zh-Hant", "en", "ja", "ko"] as const;

export type Locale = (typeof locales)[number];
export type Dictionary = typeof zhHans;

export const localeOptions: Record<
  Locale,
  { label: string; htmlLang: string }
> = {
  "zh-Hans": { label: "简体中文", htmlLang: "zh-CN" },
  "zh-Hant": { label: "繁體中文", htmlLang: "zh-TW" },
  en: { label: "English", htmlLang: "en" },
  ja: { label: "日本語", htmlLang: "ja" },
  ko: { label: "한국어", htmlLang: "ko" },
};

const dictionaries: Record<Locale, Dictionary> = {
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
  en,
  ja,
  ko,
};

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && locales.includes(value as Locale));
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
