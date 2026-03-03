"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function SearchBox() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get("q") || "")

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/browse?q=${encodeURIComponent(query.trim())}`)
    } else {
      router.push("/browse")
    }
  }

  return (
    <form
      onSubmit={handleSearch}
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
      role="search"
      aria-label="浏览提示词搜索"
    >
      <Label htmlFor="browse-search-query" className="sr-only">
        搜索提示词
      </Label>
      <Input
        id="browse-search-query"
        name="q"
        type="text"
        placeholder="搜索提示词"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" className="w-full sm:w-auto">
        搜索
      </Button>
    </form>
  )
}
