import type { Metadata } from "next";
import { Play } from "lucide-react";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "New workout · GainStep" };

export default function Page() {
  return <ComingSoon title="New workout" icon={Play} />;
}
