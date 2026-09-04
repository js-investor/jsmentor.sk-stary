import FooterSection from "@/components/sections/FooterSection";
import type { ReactNode } from "react";

type PageWrapperProps = {
  children: ReactNode;
  showFooter?: boolean;
  className?: string;
};

const PageWrapper = ({ children, showFooter = true, className }: PageWrapperProps) => (
  <main className={className}>
    {children}
    {showFooter ? <FooterSection /> : null}
  </main>
);

export default PageWrapper;
