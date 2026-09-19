import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ptBR from "./locales/pt-BR.json";
import enUS from "./locales/en-US.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": { translation: ptBR },
      "en-US": { translation: enUS },
    },
    fallbackLng: "pt-BR",
    interpolation: { escapeValue: false },
    detection: {
      // D2: `htmlTag` sits ahead of `navigator` so the language i18next picks
      // matches the static `lang="pt-BR"` declared in index.html / index.web.html.
      // With only `[localStorage, navigator]` a first-time visitor whose browser
      // reports en-US got en-US while the document still declared pt-BR — a
      // mixed-language state until `languageChanged` caught up. Honoring the
      // document element removes the mismatch at the source; returning users
      // keep their persisted choice via localStorage.
      order: ["localStorage", "htmlTag", "navigator"],
      caches: ["localStorage"],
    },
    react: {
      // Workaround for recharts #7463: "Maximum update depth exceeded when chart
      // unmounts behind Suspense boundary (React 19)". RechartsWrapper calls
      // setTooltipPortal/setLegendPortal inside a useCallback ref; React 19's
      // disappearLayoutEffects runs ref cleanup (ref(null)), and with Suspense
      // enabled these setState calls trigger an infinite loop. Disabling Suspense
      // avoids the loop. No stable recharts fix exists yet (latest is 3.10.1).
      useSuspense: false,
    },
  });

// Sync <html lang> with i18n language so <input type="date"> uses the correct locale format
i18n.on("languageChanged", (lng) => {
  const htmlLang = lng === "pt-BR" ? "pt-BR" : "en-US";
  document.documentElement.lang = htmlLang;
});
// Set initial lang
if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language === "pt-BR" ? "pt-BR" : "en-US";
}

export default i18n;
