import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import logo from "@/assets/images/wealthmap-bonusy-logo.svg";
import { cn } from "@/lib/utils";
import "./bonusy-header.css";

/**
 * Hlavička Bonusov – „tichá linka“: krémová lišta priamo na plátne stránky, hairline spodná linka,
 * textové odkazy, konzultácia ako textový odkaz so šípkou. Bez kapsuly, tieňov a gradientov.
 */

export type BonusyHeaderGroup = {
  label: string;
  items: { label: string; href: string }[];
};

type BonusyHeaderProps = {
  logoHref?: string;
  /** Iné logo než WealthMap (napr. JS Mentor na /komunita). */
  logoSrc?: string;
  logoAlt?: string;
  leadingLinks?: { label: string; href: string }[];
  groups?: BonusyHeaderGroup[];
  ctaLabel?: string;
  /** Kratší text pre úzke displeje (predvolene „Konzultácia“). */
  ctaShortLabel?: string;
  ctaHref?: string;
  ctaUmamiEvent?: string;
  ctaUmamiEventSection?: string;
};

const BonusyHeader = ({
  logoHref = "/bonusy",
  logoSrc = logo,
  logoAlt = "WealthMap bonuses",
  leadingLinks = [],
  groups = [],
  ctaLabel = "Konzultácia s Ivanom",
  ctaShortLabel = "Konzultácia",
  ctaHref,
  ctaUmamiEvent,
  ctaUmamiEventSection,
}: BonusyHeaderProps) => {
  const [openGroup, setOpenGroup] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileGroup, setMobileGroup] = useState<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  const showGroup = (index: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenGroup(index);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpenGroup(null), 160);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const ctaExternal = Boolean(ctaHref && /^https?:\/\//i.test(ctaHref));
  const ctaProps = {
    href: ctaHref,
    ...(ctaExternal ? { target: "_blank", rel: "noopener noreferrer" } : {}),
    ...(ctaUmamiEvent ? { "data-umami-event": ctaUmamiEvent } : {}),
    ...(ctaUmamiEventSection ? { "data-umami-event-section": ctaUmamiEventSection } : {}),
  };

  const renderItems = (group: BonusyHeaderGroup, itemClass: string, onPick?: () => void) =>
    group.items.length === 0 ? (
      <span className="bzh-soon">Pripravujeme…</span>
    ) : (
      group.items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={cn(itemClass, pathname === item.href && "is-active")}
          onClick={onPick}
        >
          {item.label}
        </a>
      ))
    );

  return (
    <header data-js-site-header className="bzh">
      <div className="bzh-bar">
        <a href={logoHref} className="bzh-logo" aria-label={logoAlt}>
          <img src={logoSrc} alt={logoAlt} />
        </a>

        <nav className="bzh-nav" aria-label="Navigácia stránky">
          {leadingLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn("bzh-link", pathname === link.href && "is-active")}
            >
              {link.label}
            </a>
          ))}
          {groups.map((group, index) => {
            const isOpen = openGroup === index;
            return (
              <div
                key={group.label}
                className="bzh-group"
                onMouseEnter={() => showGroup(index)}
                onMouseLeave={scheduleClose}
              >
                <button
                  type="button"
                  className={cn("bzh-link", isOpen && "is-open")}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  onClick={() => setOpenGroup(isOpen ? null : index)}
                >
                  {group.label}
                  <ChevronDown className="bzh-chev" aria-hidden />
                </button>
                <div
                  className={cn("bzh-panel-wrap", isOpen && "is-open")}
                  onMouseEnter={() => showGroup(index)}
                  onMouseLeave={scheduleClose}
                >
                  <div className="bzh-panel">{renderItems(group, "bzh-item")}</div>
                </div>
              </div>
            );
          })}
        </nav>

        {ctaHref ? (
          <a {...ctaProps} className="bzh-cta">
            <span className="bzh-cta-long">{ctaLabel}</span>
            <span className="bzh-cta-short" aria-hidden>
              {ctaShortLabel}
            </span>
            <span className="bzh-cta-arrow" aria-hidden>
              →
            </span>
          </a>
        ) : null}

        <button
          type="button"
          className="bzh-toggle"
          aria-label={menuOpen ? "Zavrieť menu" : "Otvoriť menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {menuOpen ? (
        <div className="bzh-mobile">
          <nav className="bzh-mobile-nav" aria-label="Mobilná navigácia">
            {leadingLinks.map((link) => (
              <a key={link.href} href={link.href} className="bzh-mlink" onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ))}
            {groups.map((group, index) => {
              const isOpen = mobileGroup === index;
              return (
                <div key={group.label}>
                  <button
                    type="button"
                    className="bzh-mlink"
                    aria-expanded={isOpen}
                    onClick={() => setMobileGroup(isOpen ? null : index)}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={cn("bzh-chev", isOpen && "is-open")} aria-hidden />
                  </button>
                  {isOpen ? (
                    <div className="bzh-mitems">{renderItems(group, "bzh-mitem", () => setMenuOpen(false))}</div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          {ctaHref ? (
            <a {...ctaProps} className="bzh-mcta" onClick={() => setMenuOpen(false)}>
              {ctaLabel}
              <span className="bzh-cta-arrow" aria-hidden>
                →
              </span>
            </a>
          ) : null}
        </div>
      ) : null}
    </header>
  );
};

export default BonusyHeader;
