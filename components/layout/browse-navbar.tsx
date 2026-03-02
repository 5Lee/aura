"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Session } from "next-auth"

interface BrowseNavbarProps {
  session: Session | null
}

export function BrowseNavbar({ session }: BrowseNavbarProps) {
  return (
    <nav className="border-b bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Aura
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/browse">
            <span className="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
              浏览
            </span>
          </Link>

          {session ? (
            <>
              <Link href="/dashboard">
                <Button size="sm">仪表板</Button>
              </Link>
              <Link href="/prompts">
                <Button size="sm" variant="outline">我的提示词</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="ghost">登录</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">注册</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
