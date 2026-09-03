import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { scrollToAnchorId, isScrolledNearAnchor } from "@/lib/scrollToFormular";

/** Zachytí klik na same-page anchor linky — zabráni dvojitému scrollu (browser + ScrollToTop). */
const SamePageHashLinkHandler = () => {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const { pathname, hash } = new URL(anchor.href, window.location.href);
      if (pathname !== window.location.pathname || !hash) return;

      const id = hash.slice(1);
      if (!id) return;

      event.preventDefault();
      scrollToAnchorId(id);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
};

const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = hash.replace(/^#/, "");
      if (isScrolledNearAnchor(id)) return;

      const timer = window.setTimeout(() => scrollToAnchorId(id), 0);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);
  return null;
};
import Index from "./pages/Index.tsx";
import Komunita from "./pages/Komunita.tsx";
import { KOMUNITA_PATH } from "./lib/cennikCta.ts";
import Konzultacia from "./pages/Konzultacia.tsx";
import Gdpr from "./pages/Gdpr.tsx";
import KalkulackyCategoryPage from "./pages/kalkulacky/KalkulackyCategoryPage.tsx";
import KalkulackyProductPage from "./pages/kalkulacky/KalkulackyProductPage.tsx";
import {
  BONUSY_BASE_PATH,
  KALKULACKY_CALCULATORS,
} from "./pages/kalkulacky/kalkulackyConfig.ts";
import InteligentnaHypotekaCalculator from "./components/calculators/inteligentna-hypoteka/InteligentnaHypotekaCalculator.tsx";
import InvesticnaCalculator from "./components/calculators/investicna/InvesticnaCalculator.tsx";
import MzdovaCalculator from "./components/calculators/mzdova/MzdovaCalculator.tsx";
import PodlaPrijmuCalculator from "./components/calculators/podlaprijmu/PodlaPrijmuCalculator.tsx";
import RentovaCalculator from "./components/calculators/rentova/RentovaCalculator.tsx";
import InvesticnyBytCalculator from "./components/calculators/investicny-byt/InvesticnyBytCalculator.tsx";
import EtfSemaforCalculator from "./components/calculators/etf-semafor/EtfSemaforCalculator.tsx";
import PoplatkovyRontgenCalculator from "./components/calculators/poplatkovy-rontgen/PoplatkovyRontgenCalculator.tsx";
import BytovySemaforCalculator from "./components/calculators/bytovy-semafor/BytovySemaforCalculator.tsx";
import FinancnyCheckup from "./components/checkup/FinancnyCheckup.tsx";
import SkoringBytovCalculator from "./components/calculators/skoring-bytov/SkoringBytovCalculator.tsx";
import VynosnostBytuCalculator from "./components/calculators/vynosnost-bytu/VynosnostBytuCalculator.tsx";
import NotFound from "./pages/NotFound.tsx";
import type { ReactNode } from "react";

const calculatorBySlug: Record<string, ReactNode> = {
  "inteligentna-hypoteka": <InteligentnaHypotekaCalculator />,
  "investicna-kalkulacka": <InvesticnaCalculator />,
  "mzdova-kalkulacka": <MzdovaCalculator />,
  "uverova-kalkulacka": <PodlaPrijmuCalculator />,
  "rentova-kalkulacka": <RentovaCalculator />,
  "investicny-byt": <InvesticnyBytCalculator />,
  "etf-semafor":         <EtfSemaforCalculator />,
  "poplatkovy-rontgen":  <PoplatkovyRontgenCalculator />,
  "bytovy-semafor":      <BytovySemaforCalculator />,
  "financny-checkup":    <FinancnyCheckup />,
  "skoring-bytov":       <SkoringBytovCalculator />,
  "vynosnost-bytu":      <VynosnostBytuCalculator />,
};

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <SamePageHashLinkHandler />
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path={KOMUNITA_PATH} element={<Komunita />} />
      <Route path="/konzultacia" element={<Konzultacia />} />
      <Route path="/gdpr" element={<Gdpr />} />
      <Route path={BONUSY_BASE_PATH} element={<KalkulackyCategoryPage />} />
      {/* Hypotéka vs. investovanie nahradila Inteligentná hypotéka – stará URL presmeruje */}
      <Route path={`${BONUSY_BASE_PATH}/hypo-kalkulacka`} element={<Navigate to={`${BONUSY_BASE_PATH}/inteligentna-hypoteka`} replace />} />
      {KALKULACKY_CALCULATORS.map((c) => {
        const calculator = calculatorBySlug[c.slug];
        return (
          <Route
            key={c.slug}
            path={`${BONUSY_BASE_PATH}/${c.slug}`}
            element={
              calculator ? (
                <KalkulackyProductPage title={c.title} hideTitle fullBleed={c.fullBleed}>
                  {calculator}
                </KalkulackyProductPage>
              ) : (
                <KalkulackyProductPage title={c.title} />
              )
            }
          />
        );
      })}
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
