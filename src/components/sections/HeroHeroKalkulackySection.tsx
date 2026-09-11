import AnimatedSection from "@/components/AnimatedSection";
import { CENNIK_SECTION_HREF } from "@/lib/cennikCta";
import { ArrowRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { BONUSY_BASE_PATH, BONUSY_TOTAL_VALUE, KALKULACKY_CALCULATORS } from "@/pages/kalkulacky/kalkulackyConfig";
import { ToolCard } from "@/pages/kalkulacky/bonusyCards";
import "@/pages/kalkulacky/bonusy-dashboard.css";
import "./komunita-bonusy.css";

/**
 * Sekcia bonusov na /komunita: ukazuje skutočné nástroje z /bonusy (rovnaké karty, tóny a tvary
 * ako na prehľade), nie staré screenshoty. Šesť vybraných kariet + zvyšok ako odkazy.
 */

const FEATURED = [
  "financny-checkup",
  "inteligentna-hypoteka",
  "vynosnost-bytu",
  "etf-semafor",
  "poplatkovy-rontgen",
  "rentova-kalkulacka",
  "skoring-bytov",
  "bytovy-semafor",
  "investicna-kalkulacka",
];

/** Ukážka výstupu Maximálnej hypotéky (živnostník, tržby 60 000 €, 30 rokov, 3,8 %): štyri banky z rebríčka. */
const SPECIAL_DEMO = [
  { bank: "mBank", value: "327\u00a0713\u00a0€", pct: 100 },
  { bank: "365.bank", value: "276\u00a0585\u00a0€", pct: 84 },
  { bank: "VÚB", value: "251\u00a0020\u00a0€", pct: 77 },
  { bank: "Tatra banka", value: "72\u00a0069\u00a0€", pct: 22 },
];
const SPECIAL_CHIPS = ["8 bánk", "pravidlá NBS 2026", "zamestnanec, živnostník aj s.r.o.", "za minútu"];

const HeroHeroKalkulackySection = ({ locked = false }: { locked?: boolean }) => {
  const featured = FEATURED.map((slug) => KALKULACKY_CALCULATORS.find((c) => c.slug === slug)).filter(
    (c): c is (typeof KALKULACKY_CALCULATORS)[number] => Boolean(c),
  );
  const rest = KALKULACKY_CALCULATORS.filter((c) => !FEATURED.includes(c.slug));

  return (
    <section
      id="bonusy-kalkulacky"
      className="hero-section-pad relative scroll-mt-24 overflow-hidden px-5 md:px-8 pt-[72px] pb-[72px] md:pt-[96px] md:pb-[96px]"
      style={{ backgroundColor: "#FFF9F5" }}
    >
      <div className="absolute inset-0 bg-dot-grid opacity-20 pointer-events-none" />

      <div className="section-container relative z-10">
        <AnimatedSection className="flex w-full flex-col items-center">
          <span className="inline-block rounded-full bg-primary px-5 py-2 text-[13px] font-extrabold uppercase tracking-[0.14em] text-white md:text-[14px]">
            {locked ? "Bonusy pre členov" : `Bonusy · ${KALKULACKY_CALCULATORS.length} nástrojov`}
          </span>
          <h2 className="headline-landing-section mx-auto mt-5 max-w-4xl text-pretty text-center text-[2.125rem] leading-[1.12] text-foreground md:max-w-xl md:text-[3.375rem] lg:max-w-2xl">
            <span className="font-[500]">A k tomu dostaneš aj</span> <strong className="font-bold">praktické bonusy</strong> <span aria-hidden>🎁</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center font-sans text-[1.125rem] leading-relaxed text-muted-foreground md:text-[1.25rem] lg:text-[1.375rem]">
            {locked
              ? "Trinásť kalkulačiek a nástrojov, ktoré dostaneš ako bonus hneď po pripojení do komunity. Ukážem ti, ako z nich vyťažiť maximum na tvojich vlastných číslach."
              : "Trinásť kalkulačiek a nástrojov priamo v prehliadači. Žiadna registrácia, presné čísla hneď. V komunite ti ukážem, ako z nich vyťažiť maximum na tvojich vlastných číslach."}
          </p>
          {locked ? (
            <p className="kb-value" aria-label={`${KALKULACKY_CALCULATORS.length} nástrojov v hodnote ${BONUSY_TOTAL_VALUE}, pre členov úplne zadarmo`}>
              <span className="kb-value-n">{KALKULACKY_CALCULATORS.length} nástrojov</span>
              <span className="kb-value-worth">v hodnote <s>{BONUSY_TOTAL_VALUE}</s></span>
              <span className="kb-value-free">úplne zadarmo</span>
            </p>
          ) : null}
        </AnimatedSection>

        <AnimatedSection delay={0.06}>
          <div className={locked ? "bonusy kb kb-locked" : "bonusy kb"}>
            <div className="kb-grid">
              {featured.map((meta, i) => (
                <ToolCard key={meta.slug} meta={meta} index={i} locked={locked} />
              ))}
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <div className="kb-more">
            <span className="kb-more-label">A ďalšie:</span>
            {rest.map((c) =>
              locked ? (
                <span key={c.slug} className="kb-chip kb-chip--locked">
                  <Lock className="h-3 w-3" strokeWidth={2.25} aria-hidden />
                  {c.menuLabel}
                </span>
              ) : (
                <Link key={c.slug} to={`${BONUSY_BASE_PATH}/${c.slug}`} className="kb-chip">
                  {c.menuLabel}
                </Link>
              ),
            )}
          </div>
        </AnimatedSection>

        {locked ? (
          <AnimatedSection delay={0.12}>
            {/* Špeciálny bonus: prémiová karta na celú šírku (tmavá hnedá + zlatá), vpravo ukážka výstupu nástroja */}
            <div className="kb-special" aria-label="Špeciálny bonus: Ktorá banka ti požičia najviac?">
              <div className="kb-special-grid">
                <div>
                  <span className="kb-special-eyebrow">Špeciálny bonus · len pre členov</span>
                  <h3 className="kb-special-title">Ktorá banka ti požičia najviac?</h3>
                  <p className="kb-special-text">
                    Vytvoril som nástroj, ktorý za minútu porovná všetkých 8 slovenských bánk podľa pravidiel NBS a povie ti, kde dostaneš najvyššiu hypotéku.
                    Rozdiel medzi bankami býva desiatky tisíc eur. Nemusíš chodiť po bankách – všetko máš v jednom nástroji.
                  </p>
                  <div className="kb-special-chips">
                    {SPECIAL_CHIPS.map((c) => (
                      <span key={c} className="kb-special-chip">{c}</span>
                    ))}
                  </div>
                  <span className="kb-special-lock"><Lock className="h-4 w-4" strokeWidth={2} aria-hidden /> Odomkne sa po pripojení</span>
                </div>
                <div className="kb-special-demo" aria-hidden>
                  <p className="kb-special-demo-cap"><span>Ukážka: živnostník, tržby 60 000 €</span><span>max. hypotéka</span></p>
                  {SPECIAL_DEMO.map((r, i) => (
                    <div key={r.bank} className={i === 0 ? "kb-special-row is-top" : "kb-special-row"}>
                      <span>{r.bank}</span>
                      <span className="kb-special-track"><i className="kb-special-fill" style={{ width: `${r.pct}%` }} /></span>
                      <b>{r.value}</b>
                    </div>
                  ))}
                  <p className="kb-special-diff"><span>Rozdiel medzi najlepšou a najhoršou bankou</span><b>255 644 €</b></p>
                </div>
              </div>
            </div>
          </AnimatedSection>
        ) : null}

        <AnimatedSection delay={0.14} className="w-full text-center">
          <div className="kb-actions">
            <a href={CENNIK_SECTION_HREF} className="btn-primary inline-flex text-body" data-umami-event="click_cennik" data-umami-event-section="kalkulacky">
              {locked ? "Odomknúť bonusy zadarmo 🎁" : "Chcem tieto bonusy 🎁"}
            </a>
            {locked ? (
              <span className="kb-note">Bonusy sa odomknú hneď po pripojení. Prvé 2 týždne zadarmo.</span>
            ) : (
              <Link to={BONUSY_BASE_PATH} className="kb-link">
                Vyskúšať všetky nástroje zadarmo <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default HeroHeroKalkulackySection;
