import { renderToStaticMarkup } from "react-dom/server"

let latestMarkup = ""
const statefulText = new Map()

const stripTags = (value) =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const normalizeTarget = (target) => {
  if (typeof target === "string") {
    return { matcher: target, matches: (text) => text.includes(target) }
  }

  if (target instanceof RegExp) {
    return { matcher: target, matches: (text) => target.test(text) }
  }

  throw new Error("Only string and RegExp matchers are supported.")
}

const serializeProps = (props = {}) => {
  const attributes = Object.entries(props)
    .filter(([key, value]) => key !== "children" && value !== false && value != null)
    .map(([key, value]) => {
      if (value === true) {
        return key
      }

      if (typeof value === "string") {
        return `${key}=\"${value}\"`
      }

      return `${key}=\"${String(value)}\"`
    })

  return attributes.length ? ` ${attributes.join(" ")}` : ""
}

const extractNodePropsByText = (textValue) => {
  const escaped = textValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`<([\\w-]+)([^>]*)>\\s*${escaped}\\s*</\\1>`, "i")
  const match = latestMarkup.match(regex)
  if (!match) {
    return {}
  }

  const rawAttributes = match[2] ?? ""
  const props = {}
  const attrRegex = /([\w:-]+)(?:=\"([^\"]*)\")?/g
  for (const [, key, value] of rawAttributes.matchAll(attrRegex)) {
    props[key] = value ?? true
  }
  return props
}

const createNodeHandle = (text) => {
  const props = statefulText.get(text) ?? {}
  return {
    textContent: text,
    disabled:
      props.disabled === true ||
      props.disabled === "disabled" ||
      props.disabled === "",
    getAttribute: (name) => (name in props ? String(props[name]) : null),
    toString: () => `<mock-node${serializeProps(props)}>${text}</mock-node>`,
  }
}

export const render = (ui) => {
  latestMarkup = renderToStaticMarkup(ui)
  statefulText.clear()

  const text = stripTags(latestMarkup)
  if (text.length > 0) {
    statefulText.set(text, extractNodePropsByText(text))
  }

  return {
    container: {
      innerHTML: latestMarkup,
      textContent: text,
    },
  }
}

const queryByText = (target) => {
  const { matcher, matches } = normalizeTarget(target)
  for (const [text] of statefulText.entries()) {
    if (matches(text)) {
      return createNodeHandle(text)
    }
  }

  const flattened = stripTags(latestMarkup)
  if (flattened && matches(flattened)) {
    return createNodeHandle(flattened)
  }

  return null
}

const getByText = (target) => {
  const node = queryByText(target)
  if (node) {
    return node
  }

  const { matcher } = normalizeTarget(target)
  throw new Error(`Unable to find element with text: ${String(matcher)}`)
}

export const cleanup = () => {
  latestMarkup = ""
  statefulText.clear()
}

export const screen = {
  getByText,
  queryByText,
}
