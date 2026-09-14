import HeroSectionTemplate from "@/components/templates/HeroSectionTemplate";
import HeroTrustStatsBar from "@/components/sections/HeroTrustStatsBar";
import { CENNIK_SECTION_HREF } from "@/lib/cennikCta";

const HomeDesignHeaderSection = () => {
  return (
    <HeroSectionTemplate
      compactBottom
      preheaderClassName="rounded-full bg-[#7A1F1F] px-3 py-1 text-[0.8125rem] md:px-4 md:py-1.5 md:text-[1rem] font-sans font-medium normal-case tracking-normal text-white whitespace-nowrap"
      subtitleClassName="hero-subheadline"
      descriptionClassName="hero-description !text-[1.0625rem] md:!text-[1.125rem] lg:!text-[1.1875rem]"
      headerCtaLabel="Chcem sa pridať ZADARMO 🚀"
      headerCtaHref={CENNIK_SECTION_HREF}
      preheader={<>Miesto, kde konečne pochopíš, ako fungujú peniaze</>}
      title={
        <>
          Toto je cesta
          <br />
          k bohatšiemu životu.
        </>
      }
      subtitle="Vyšší príjem ti môže kúpiť pohodlie. Rozumné finančné rozhodnutia ti kupujú slobodu."
      description="V mojej komunite ti ukážem, ako robiť lepšie rozhodnutia pri investovaní, hypotéke, fondoch, ETF, nehnuteľnostiach, rente a produktoch, ktoré ťa môžu stáť tisíce eur."
      trustStatsPanel={<HeroTrustStatsBar />}
      heroCtaLabel="Chcem sa pridať ZADARMO 🚀"
      heroCtaHref={CENNIK_SECTION_HREF}
      videoSrc="https://player.vimeo.com/video/1226685451?h=aec7c135bf&autoplay=0&title=0&portrait=0&byline=0"
      videoTitle="Prečo väčšina neuspeje"
    />
  );
};

export default HomeDesignHeaderSection;
