import { ReactNode } from "react";

export const metadata = {
  description: "Palace landing page.",
};

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      aria-label="layout"
      className="flex min-h-dvh flex-col bg-white text-[#000]"
    >
      {children}
    </div>
  );
}
