import { scrollToAnchorId } from "@/lib/scrollToFormular";

export const KOMUNITA_PATH = "/komunita";
export const CENNIK_SECTION_ID = "CTA1";
export const CENNIK_SECTION_HASH = `#${CENNIK_SECTION_ID}`;
export const CENNIK_SECTION_HREF = `${KOMUNITA_PATH}${CENNIK_SECTION_HASH}`;
export const HEROHERO_JOIN_URL = "https://herohero.co/jsmentor";

function isKomunitaPage(): boolean {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === KOMUNITA_PATH;
}

export function scrollToCennik(): void {
  scrollToAnchorId(CENNIK_SECTION_ID);
}

/** Na /komunita scrolluje na CTA1, inde presmeruje na /komunita#CTA1. */
export function navigateToCennik(): void {
  if (isKomunitaPage()) {
    scrollToCennik();
    if (window.location.hash !== CENNIK_SECTION_HASH) {
      window.history.replaceState(null, "", `${KOMUNITA_PATH}${CENNIK_SECTION_HASH}`);
    }
    return;
  }

  window.location.href = CENNIK_SECTION_HREF;
}
