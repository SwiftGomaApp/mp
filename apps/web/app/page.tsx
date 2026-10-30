import { ModeToggle } from "@/components/global/theme-button";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>SwiftGoma</p>
      <ModeToggle />
    </div>
  );
}
