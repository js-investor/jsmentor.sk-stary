import type { ReactNode } from "react";

/**
 * Prevedie značky z komunitaContent.ts na React uzly:
 * `**text**` → <strong>, `[text](href)` → <a>, `\n` → <br />.
 */
export function rich(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\n)/g;
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("[")) {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (link) parts.push(<a key={key++} href={link[2]}>{link[1]}</a>);
    } else {
      parts.push(<br key={key++} />);
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
