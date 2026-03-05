import type { ReactNode } from "react"

import { AdminSubnav } from "@/components/layout/admin-subnav"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <AdminSubnav />
      {children}
    </div>
  )
}
