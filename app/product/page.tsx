import { OriginalNavbar } from "@/components/ui/navbars";
import Link from "next/link";

export default function ProductPage() {
  return (
    <div className="bg-paper text-void font-sans">
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-subtle">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3">
                  <img
                      src="/assets/logo_top_corner.png"
                      className="h-7 max-h-7 w-auto object-contain"
                      alt="SynthForce"
                  />
              </Link>
              <OriginalNavbar/>

          </div>
        </div>
      </nav>
    </div>
  )
}