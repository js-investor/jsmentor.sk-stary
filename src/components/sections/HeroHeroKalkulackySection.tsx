import AnimatedSection from "@/components/AnimatedSection";
import { CENNIK_SECTION_HREF } from "@/lib/cennikCta";
import { ArrowRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { BONUSY_BASE_PATH, KALKULACKY_CALCULATORS } from "@/pages/kalkulacky/kalkulackyConfig";
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
];

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
            Bonusy · {KALKULACKY_CALCULATORS.length} nástrojov
          </span>
          <h2 className="headline-landing-section mx-auto mt-5 max-w-4xl text-pretty text-center text-[2.125rem] leading-[1.12] text-foreground md:max-w-xl md:text-[3.375rem] lg:max-w-2xl">
            <span className="font-[500]">A k tomu dostaneš aj</span> <strong className="font-bold">praktické bonusy</strong> <span aria-hidden>🎁</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-center font-sans text-[1.125rem] leading-relaxed text-muted-foreground md:text-[1.25rem] lg:text-[1.375rem]">
            {locked
              ? "Dvanásť kalkulačiek a nástrojov, ktoré dostaneš ako bonus hneď po pripojení do komunity. Ukážem ti, ako z nich vyťažiť maximum na tvojich vlastných číslach."
              : "Dvanásť kalkulačiek a nástrojov priamo v prehliadači. Žiadna registrácia, presné čísla hneď. V komunite ti ukážem, ako z nich vyťažiť maximum na tvojich vlastných číslach."}
          </p>
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
