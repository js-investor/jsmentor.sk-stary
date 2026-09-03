import PageWrapper from "@/components/layout/PageWrapper";
import BonusyHeader from "@/components/layout/BonusyHeader";
import { KALKULACKY_HEADER_GROUPS, KONZULTACIA_URL } from "@/pages/kalkulacky/kalkulackyConfig";
import type { ReactNode } from "react";

type KalkulackyShellProps = {
  children: ReactNode;
  /** Full-bleed mode: sekcie kalkulačky samy manažujú šírku aj pozadie. */
  fullBleed?: boolean;
};

/* Hlavička je v toku stránky (sticky), preto stačí bežný odstup od nej, nie miesto pre plávajúcu kapsulu. */
const KalkulackyShell = ({ children, fullBleed = false }: KalkulackyShellProps) => (
  <PageWrapper>
    <BonusyHeader
      logoHref="/bonusy"
      leadingLinks={[{ label: "Všetky bonusy", href: "/bonusy" }]}
      groups={KALKULACKY_HEADER_GROUPS}
      ctaLabel="Konzultácia s Ivanom"
      ctaHref={KONZULTACIA_URL}
      ctaUmamiEvent="click_konzultacia"
      ctaUmamiEventSection="bonusy-header"
    />
    {fullBleed ? (
      <div className="page-home bg-background pt-10 md:pt-12 lg:pt-14">
        {children}
      </div>
    ) : (
      <section className="page-home section-white min-h-[50vh] pt-10 pb-20 md:pt-12 md:pb-28 lg:pt-14 lg:pb-32">
        {children}
      </section>
    )}
  </PageWrapper>
);

export default KalkulackyShell;
