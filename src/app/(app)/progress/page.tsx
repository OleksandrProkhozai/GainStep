import type { Metadata } from "next";
import { ChartLine } from "lucide-react";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Progress · GainStep" };

export default function Page() {
  return <ComingSoon title="Progress" icon={ChartLine} />;
}
