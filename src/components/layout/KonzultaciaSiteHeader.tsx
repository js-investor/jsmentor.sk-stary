import brandLogo from "@/assets/images/js-mentor-logo.png";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type HeaderItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type HeaderGroup = {
  label: string;
  items: { label: string; href: string }[];
};

type KonzultaciaSiteHeaderProps = {
  items?: HeaderItem[];
  /** Nahradí flat `items` — zobrazí sa ako dropdown skupiny. */
  groups?: HeaderGroup[];
  /** Jednoduché priame linky zobrazené pred skupinami. */
  leadingLinks?: { label: string; href: string }[];
  ctaLabel?: string;
  ctaUmamiEvent?: string;
  ctaUmamiEventSection?: string;
  logoHref?: string;
  ctaMobileLabel?: string;
  ctaHref?: string;
  ctaIcon?: ReactNode;
  ctaOnClick?: () => void;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  secondaryCtaOnClick?: () => void;
  logoOnly?: boolean;
};

const navLinkClass =
  "rounded-full px-3.5 py-2 font-sans text-sm font-medium text-foreground/75 transition-colors hover:bg-primary/[0.07] hover:text-primary lg:px-4 lg:text-[0.9375rem]";

const KonzultaciaSiteHeader = ({
  items = [],
  groups,
  leadingLinks,
  ctaLabel = "Chcem začať teraz",
  ctaUmamiEvent,
  ctaUmamiEventSection,
  logoHref = "/konzultacia",
  ctaMobileLabel,
  ctaHref,
  ctaIcon,
  ctaOnClick,
  secondaryCtaLabel,
  secondaryCtaHref,
  secondaryCtaOnClick,
  logoOnly = false,
}: KonzultaciaSiteHeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoverGroup, setHoverGroup] = useState<number | null>(null);
  const [mobileOpenGroup, setMobileOpenGroup] = useState<number | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDropdown = (gi: number) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHoverGroup(gi);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setHoverGroup(null), 160);
  };

  const handleItemClick = (item: HeaderItem) => {
    item.onClick?.();
    setMobileMenuOpen(false);
  };

  const ctaOpensNewTab = Boolean(ctaHref && /^https?:\/\//i.test(ctaHref));

  const ctaClassName = cn(
    "btn-primary btn-primary-site-header text-body shrink-0",
    ctaIcon && "inline-flex items-center gap-2"
  );

  const ctaButton = ctaHref ? (
    <a
      href={ctaHref}
      {...(ctaOpensNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={ctaClassName}
      onClick={() => setMobileMenuOpen(false)}
      {...(ctaUmamiEvent ? { "data-umami-event": ctaUmamiEvent } : {})}
      {...(ctaUmamiEventSection ? { "data-umami-event-section": ctaUmamiEventSection } : {})}
      {...(ctaUmamiEvent === "click_konzultacia" && ctaUmamiEventSection ? { "data-umami-event-slug": ctaUmamiEventSection } : {})}
    >
      {ctaIcon}
      {ctaLabel}
    </a>
  ) : (
    <button type="button" onClick={ctaOnClick} className={ctaClassName}>
      {ctaIcon}
      {ctaLabel}
    </button>
  );

  const mobileLabel = ctaMobileLabel ? (
    <>
      <span className="sm:hidden">{ctaMobileLabel}</span>
      <span className="hidden sm:inline">{ctaLabel}</span>
    </>
  ) : ctaLabel;
  const ctaMobileButton = ctaHref ? (
    <a
      href={ctaHref}
      {...(ctaOpensNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={ctaClassName}
      onClick={() => setMobileMenuOpen(false)}
      {...(ctaUmamiEvent ? { "data-umami-event": ctaUmamiEvent } : {})}
      {...(ctaUmamiEventSection ? { "data-umami-event-section": ctaUmamiEventSection } : {})}
      {...(ctaUmamiEvent === "click_konzultacia" && ctaUmamiEventSection ? { "data-umami-event-slug": ctaUmamiEventSection } : {})}
    >
      {ctaIcon}
      {mobileLabel}
    </a>
  ) : (
    <button type="button" onClick={ctaOnClick} className={ctaClassName}>
      {ctaIcon}
      {mobileLabel}
    </button>
  );

  const secondaryCtaClassName = "konzultacia-header-secondary-cta";

  const renderSecondaryCta = (className: string) => {
    if (!secondaryCtaLabel) return null;
    if (secondaryCtaHref) {
      return (
        <a href={secondaryCtaHref} className={className} onClick={() => setMobileMenuOpen(false)}>
          {secondaryCtaLabel}
        </a>
      );
    }
    return (
      <button type="button" onClick={secondaryCtaOnClick} className={className}>
        {secondaryCtaLabel}
      </button>
    );
  };

  const logo = (
    <a href={logoHref} className="flex shrink-0 items-center">
      <img
        src={brandLogo}
        alt="JS Mentor logo"
        className="h-7 w-auto shrink-0 object-contain md:h-9 lg:h-10"
      />
    </a>
  );

  if (logoOnly) {
    return (
      <header data-js-site-header className="konzultacia-header-shell">
        <div className="konzultacia-header-bar konzultacia-header-bar--logo-only">{logo}</div>
      </header>
    );
  }

  return (
    <header data-js-site-header className="konzultacia-header-shell">
      <div className="konzultacia-header-bar">
        {logo}

        <nav className="konzultacia-header-nav hidden min-w-0 xl:flex" aria-label="Navigácia stránky">
          {leadingLinks?.map((link) => (
            <a key={link.href} href={link.href} className={navLinkClass}>
              {link.label}
            </a>
          ))}
          {groups
            ? groups.map((group, gi) => (
                <div
                  key={group.label}
                  className="relative"
                  onMouseEnter={() => openDropdown(gi)}
                  onMouseLeave={scheduleClose}
                >
                  <button
                    type="button"
                    className={cn(navLinkClass, "inline-flex items-center gap-1")}
                    aria-expanded={hoverGroup === gi}
                    aria-haspopup="true"
                  >
                    {group.label}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-200",
                        hoverGroup === gi && "rotate-180"
                      )}
                    />
                  </button>

                  {/* pt-2 = transparent bridge that closes the gap between trigger and panel */}
                  <div
                    className={cn(
                      "absolute left-0 top-full z-50 pt-2 min-w-[220px]",
                      hoverGroup === gi ? "block" : "hidden"
                    )}
                    onMouseEnter={() => openDropdown(gi)}
                    onMouseLeave={scheduleClose}
                  >
                    <div className="overflow-hidden rounded-xl border border-border/50 bg-white py-1.5 shadow-xl">
                      {group.items.length === 0 ? (
                        <span className="block px-4 py-3 text-xs font-semibold text-foreground/40">
                          Pripravujeme…
                        </span>
                      ) : (
                        group.items.map((item) => (
                          <a
                            key={item.label}
                            href={item.href}
                            className="block px-4 py-3 text-sm font-medium text-foreground/75 transition-colors hover:bg-primary/[0.07] hover:text-primary"
                          >
                            {item.label}
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))
            : items.map((item) =>
                item.href ? (
                  <a key={item.label} href={item.href} className={navLinkClass}>
                    {item.label}
                  </a>
                ) : (
                  <button key={item.label} type="button" onClick={() => item.onClick?.()} className={navLinkClass}>
                    {item.label}
                  </button>
                )
              )}
        </nav>

        <div className="konzultacia-header-mobile-cta xl:hidden">{ctaMobileButton}</div>

        <div className="konzultacia-header-actions">
          <div className="hidden items-center gap-2.5 xl:flex">
            {renderSecondaryCta(secondaryCtaClassName)}
            {ctaButton}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Zavrieť menu" : "Otvoriť menu"}
            aria-expanded={mobileMenuOpen}
            className="konzultacia-header-menu-toggle xl:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="konzultacia-header-mobile-panel xl:hidden">
            <nav className="flex flex-col gap-0.5" aria-label="Mobilná navigácia">
              {leadingLinks?.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="konzultacia-header-mobile-link"
                >
                  {link.label}
                </a>
              ))}
              {groups
                ? groups.map((group, gi) => (
                    <div key={group.label}>
                      <button
                        type="button"
                        className="konzultacia-header-mobile-link w-full justify-between"
                        onClick={() =>
                          setMobileOpenGroup(mobileOpenGroup === gi ? null : gi)
                        }
                      >
                        <span>{group.label}</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform duration-200",
                            mobileOpenGroup === gi && "rotate-180"
                          )}
                        />
                      </button>
                      {mobileOpenGroup === gi && (
                        <div className="flex flex-col gap-0.5 pb-1 pl-4">
                          {group.items.length === 0 ? (
                            <span className="px-3 py-2 text-xs font-semibold text-foreground/40">
                              Pripravujeme…
                            </span>
                          ) : (
                            group.items.map((item) => (
                              <a
                                key={item.label}
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="konzultacia-header-mobile-link"
                              >
                                {item.label}
                              </a>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))
                : items.map((item) =>
                    item.href ? (
                      <a
                        key={item.label}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="konzultacia-header-mobile-link"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handleItemClick(item)}
                        className="konzultacia-header-mobile-link"
                      >
                        {item.label}
                      </button>
                    )
                  )}
            </nav>
            {secondaryCtaLabel ? (
              <div className="mt-2">{renderSecondaryCta("konzultacia-header-mobile-link font-semibold text-primary")}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default KonzultaciaSiteHeader;
