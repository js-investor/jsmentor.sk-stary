import ivanKnihaJsMentor from "@/assets/images/ivan-jasik-js-mentor-kniha.png";
import brandPatternDark from "@/assets/logo/js-brand-pattern-black.svg";
import { BONUSY_CTA_LABEL, KALKULACKY_KONZULTACIA_CARD } from "@/pages/kalkulacky/kalkulackyConfig";
import { NOISE_TEXTURE } from "@/lib/noiseTexture";

const BonusyKonzultaciaSection = () => (
  <section className="mx-auto mt-12 max-w-5xl md:mt-16" aria-labelledby="bonusy-konzultacia-heading">
    <div className="relative isolate overflow-hidden rounded-2xl shadow-[inset_0_1px_0_rgba(255,249,245,0.12),0_12px_40px_-12px_rgba(28,22,18,0.55)]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(145deg, #4c3c2d 0%, #6a5746 38%, #a58c75 72%, #876d55 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          boxShadow:
            "inset 0 0 120px 40px rgba(28, 22, 18, 0.35), inset 0 0 48px 12px rgba(76, 60, 45, 0.25)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.14] mix-blend-soft-light"
        style={{
          backgroundImage: NOISE_TEXTURE,
        }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[#c4a882]/15 mix-blend-multiply" />

      <div className="relative z-[1] flex min-h-[280px] flex-col gap-8 pb-0 pt-2 text-[#fdf8f2] sm:min-h-[300px] md:min-h-[320px] md:flex-row md:items-stretch md:gap-0 md:pb-0 md:pt-2">
        <div className="flex w-full flex-col items-start justify-center gap-5 px-4 pb-8 pt-8 text-left sm:px-6 md:min-h-0 md:min-w-0 md:flex-1 md:justify-center md:gap-6 md:px-8 md:py-12 md:pr-5 md:pb-12">
          <h2
            id="bonusy-konzultacia-heading"
            className="w-full [font-family:var(--font-serif)] text-[1.875rem] font-bold leading-[1.12] tracking-normal text-[#fdf8f2] sm:text-3xl md:text-4xl lg:text-[2.75rem] lg:leading-[1.1]"
          >
            {KALKULACKY_KONZULTACIA_CARD.title}
          </h2>
          <p className="w-full max-w-none font-sans text-[1.125rem] leading-relaxed text-[#f0ebe3]/90 sm:text-[1.1875rem] md:max-w-lg md:text-xl md:leading-[1.65] lg:max-w-xl">
            {KALKULACKY_KONZULTACIA_CARD.description}
          </p>
          <a
            href={KALKULACKY_KONZULTACIA_CARD.href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary btn-primary-site-header mt-1 inline-flex items-center gap-2 text-body"
            data-umami-event="click_konzultacia"
            data-umami-event-section="bonusy-konzultacia"
            data-umami-event-slug="bonusy-konzultacia"
          >
            {BONUSY_CTA_LABEL}
          </a>
        </div>

        <div className="relative flex w-full min-h-0 flex-1 shrink-0 flex-col items-center justify-end overflow-hidden px-4 pb-0 pt-0 md:flex-none md:w-[42%] md:items-center md:justify-end md:self-stretch md:overflow-hidden md:px-5 md:pb-0 md:pt-6 lg:w-[38%]">
          <img
            src={brandPatternDark}
            alt=""
            aria-hidden
            className="pointer-events-none absolute right-0 top-0 z-0 h-auto max-h-[min(598px,100%)] w-auto max-w-[min(495px,100%)] origin-top-right select-none opacity-[0.1] md:max-h-[min(690px,100%)] md:max-w-[min(546px,100%)]"
          />
          <div className="relative z-[1] flex w-full justify-center leading-none md:w-auto">
            <div className="relative mx-auto md:mx-auto">
              <img
                src={ivanKnihaJsMentor}
                alt="Ivan Jašík s knihou Psychológia peňazí"
                className="relative z-[1] mx-auto block max-h-64 w-auto max-w-full object-contain object-bottom contrast-[1.05] saturate-[0.92] brightness-[0.97] sepia-[0.22] drop-shadow-[0_8px_22px_rgba(28,22,18,0.4)] sm:max-h-72 md:max-h-80"
              />
              <div className="pointer-events-none absolute bottom-2 left-1/2 z-[1] hidden h-16 w-12 -translate-x-1/2 rounded-full bg-gradient-to-tr from-white/10 to-transparent opacity-20 blur-md md:block" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default BonusyKonzultaciaSection;
