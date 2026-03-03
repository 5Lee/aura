const CATEGORY_COVER_MAP: Array<{ keyword: string; src: string }> = [
  { keyword: "写作", src: "/images/prompt-covers/writing.svg" },
  { keyword: "编程", src: "/images/prompt-covers/coding.svg" },
  { keyword: "数据", src: "/images/prompt-covers/data.svg" },
  { keyword: "创意", src: "/images/prompt-covers/design.svg" },
  { keyword: "设计", src: "/images/prompt-covers/design.svg" },
  { keyword: "教育", src: "/images/prompt-covers/education.svg" },
]

export const COVER_BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTYnIGhlaWdodD0nMTAnIHZpZXdCb3g9JzAgMCAxNiAxMCcgZmlsbD0nbm9uZScgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48cmVjdCB3aWR0aD0nMTYnIGhlaWdodD0nMTAnIGZpbGw9JyMyNzM4NTAnLz48L3N2Zz4="

export function getPromptCoverByCategory(categoryName: string | null | undefined): string {
  if (!categoryName) {
    return "/images/prompt-covers/default.svg"
  }

  const matched = CATEGORY_COVER_MAP.find((item) => categoryName.includes(item.keyword))
  return matched?.src ?? "/images/prompt-covers/default.svg"
}
