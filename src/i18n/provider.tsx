"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type Dictionary,
  getDictionary,
  isLocale,
  type Locale,
  localeOptions,
} from "./dictionaries";

const storageKey = "aspoem_locale";

type LocaleContextValue = {
  dictionary: Dictionary;
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh-Hans");

  useEffect(() => {
    const savedLocale = window.localStorage.getItem(storageKey);
    const browserLocale = navigator.language;
    const preferredLocale = isLocale(savedLocale)
      ? savedLocale
      : browserLocale.startsWith("zh-TW") || browserLocale.startsWith("zh-HK")
        ? "zh-Hant"
        : browserLocale.startsWith("ja")
          ? "ja"
          : browserLocale.startsWith("ko")
            ? "ko"
            : browserLocale.startsWith("en")
              ? "en"
              : "zh-Hans";

    setLocaleState(preferredLocale);
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(storageKey, nextLocale);
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = localeOptions[locale].htmlLang;
  }, [locale]);

  const value = useMemo(
    () => ({ dictionary: getDictionary(locale), locale, setLocale }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) {
    throw new Error("useLocale must be used within LocaleProvider");
  }

  return value;
}
