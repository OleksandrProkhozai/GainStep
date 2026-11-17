import type { Metadata } from "next";
import { LayoutGrid } from "lucide-react";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Programs · GainStep" };

export default function Page() {
  return <ComingSoon title="Programs" icon={LayoutGrid} />;
}
