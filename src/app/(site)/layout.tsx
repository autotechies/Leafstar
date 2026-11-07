import type { ReactNode } from "react";
import { SiteShell } from "@/modules/site/components/SiteShell";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
