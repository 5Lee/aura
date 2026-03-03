"use client"

import { SessionProvider } from "next-auth/react"
import { Navbar } from "@/components/layout/navbar"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { MobilePageHeader } from "@/components/layout/mobile-page-header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="container mx-auto px-4 py-6 pb-24 sm:py-8 sm:pb-24 md:pb-8">
          <MobilePageHeader />
          {children}
        </main>
        <MobileBottomNav />
      </div>
    </SessionProvider>
  )
}
