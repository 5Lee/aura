import { getServerSession } from "next-auth"

import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { MobilePageHeader } from "@/components/layout/mobile-page-header"
import { Navbar } from "@/components/layout/navbar"
import { authOptions } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <div className="min-h-screen bg-transparent">
      <Navbar session={session} />
      <main className="relative mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 sm:pt-8 md:pb-10 lg:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-4 top-0 -z-10 h-40 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_58%),radial-gradient(circle_at_top_right,hsl(var(--accent)/0.14),transparent_42%)] blur-3xl"
        />
        <MobilePageHeader />
        <div className="relative">{children}</div>
      </main>
      <MobileBottomNav />
    </div>
  )
}
