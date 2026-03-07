import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SearchBoxProps {
  defaultQuery?: string
  category?: string
}

export function SearchBox({ defaultQuery = "", category }: SearchBoxProps) {
  return (
    <form
      action="/browse"
      className="flex w-full flex-col gap-3 sm:flex-row"
      method="get"
      role="search"
      aria-label="浏览提示词搜索"
    >
      {category ? <input type="hidden" name="category" value={category} /> : null}
      <Label htmlFor="browse-search-query" className="sr-only">
        搜索提示词
      </Label>
      <div className="relative flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="browse-search-query"
          name="q"
          type="search"
          placeholder="搜索标题、标签、用途或灵感方向"
          defaultValue={defaultQuery}
          className="h-12 rounded-full border-border/70 bg-background/88 pl-11 pr-4 text-sm shadow-sm"
        />
      </div>
      <Button type="submit" className="h-12 rounded-full px-5 shadow-primary sm:w-auto">
        立即搜索
      </Button>
    </form>
  )
}
