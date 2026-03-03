const normalizeText = (value) => value.replace(/\s+/g, " ").trim()

const hasNodeText = (element) => normalizeText(element.textContent ?? "").length > 0

const isHiddenInput = (element) =>
  element.tagName.toLowerCase() === "input" && element.getAttribute("type") === "hidden"

const hasAssociatedLabel = (element) => {
  if (element.closest("label")) {
    return true
  }

  const id = element.getAttribute("id")
  if (!id) {
    return false
  }

  const linkedLabel = document.querySelector(`label[for="${id}"]`)
  return Boolean(linkedLabel && hasNodeText(linkedLabel))
}

const hasAccessibleName = (element) => {
  if (element.hasAttribute("aria-label")) {
    return normalizeText(element.getAttribute("aria-label") ?? "").length > 0
  }

  if (element.hasAttribute("aria-labelledby")) {
    const labelledBy = element.getAttribute("aria-labelledby") ?? ""
    const ids = labelledBy
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)

    if (ids.length === 0) {
      return false
    }

    const text = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((node) => normalizeText(node.textContent ?? ""))
      .join(" ")

    return text.length > 0
  }

  return hasNodeText(element)
}

const collectViolations = () => {
  const violations = []
  const namedControlSelector = "button, [role='button'], input, select, textarea"

  for (const element of document.querySelectorAll(namedControlSelector)) {
    if (isHiddenInput(element)) {
      continue
    }

    const tagName = element.tagName.toLowerCase()
    const needsLabel = tagName === "input" || tagName === "select" || tagName === "textarea"
    const hasName = hasAccessibleName(element)
    const hasLabel = needsLabel ? hasAssociatedLabel(element) || hasName : hasName

    if (!hasLabel) {
      violations.push({
        id: "control-has-accessible-name",
        impact: "serious",
        target: `<${tagName}>`,
      })
    }
  }

  for (const image of document.querySelectorAll("img")) {
    if (!image.hasAttribute("alt")) {
      violations.push({
        id: "image-alt",
        impact: "serious",
        target: "<img>",
      })
    }
  }

  return violations
}

const reportViolations = (violations, silent) => {
  if (silent) {
    return
  }

  if (violations.length === 0) {
    console.info("[axe-lite] no serious accessibility issues detected")
    return
  }

  console.groupCollapsed(
    `[axe-lite] ${violations.length} serious accessibility issue(s) detected`
  )

  for (const violation of violations) {
    console.error(
      `[${violation.impact}] ${violation.id} at ${violation.target}`
    )
  }

  console.groupEnd()
}

export default async function axeLite(
  react,
  reactDom,
  timeout = 1000,
  options = {}
) {
  void react
  void reactDom

  if (typeof window === "undefined" || typeof document === "undefined") {
    return
  }

  const delay = Number.isFinite(timeout) ? Math.max(0, Number(timeout)) : 1000
  const silent = options?.silent === true
  let timer = null

  const runAudit = () => {
    timer = null
    const violations = collectViolations()
    reportViolations(violations, silent)
  }

  const scheduleAudit = () => {
    if (timer !== null) {
      window.clearTimeout(timer)
    }
    timer = window.setTimeout(runAudit, delay)
  }

  scheduleAudit()

  const observer = new MutationObserver(() => {
    scheduleAudit()
  })

  observer.observe(document.body ?? document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "aria-label",
      "aria-labelledby",
      "for",
      "id",
      "alt",
      "role",
      "type",
    ],
  })

  window.addEventListener(
    "beforeunload",
    () => {
      if (timer !== null) {
        window.clearTimeout(timer)
      }
      observer.disconnect()
    },
    { once: true }
  )
}
