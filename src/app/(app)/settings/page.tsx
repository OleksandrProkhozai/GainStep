import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/app-shell/coming-soon";

export const metadata: Metadata = { title: "Settings · GainStep" };

export default function Page() {
  return <ComingSoon title="Settings" icon={Settings} />;
}
