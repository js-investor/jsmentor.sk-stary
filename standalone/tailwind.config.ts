import type { Config } from "tailwindcss";
import path from "path";
import base from "../tailwind.config";

/** Tailwind pre samostatné buildy: len triedy z kalkulačiek, písma namapované na vložené Matter / Calvino. */
const root = path.resolve(__dirname, "..");

export default {
  ...base,
  content: [
    `${root}/src/components/calculators/**/*.{ts,tsx}`,
    `${root}/src/components/checkup/**/*.{ts,tsx}`,
    `${root}/standalone/*.{ts,tsx,html}`,
  ],
  theme: {
    ...base.theme,
    extend: {
      ...(base.theme?.extend ?? {}),
      fontFamily: {
        serif: ["Calvino", "Georgia", "serif"],
        sans: ["Matter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
} satisfies Config;
