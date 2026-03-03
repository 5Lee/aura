import { inspect } from "node:util"

const registryKey = "__PLAYWRIGHT_TEST_LITE_REGISTRY__"

const getRegistry = () => {
  if (!globalThis[registryKey]) {
    globalThis[registryKey] = {
      suites: [{ title: "", beforeEach: [], afterEach: [] }],
      tests: [],
    }
  }

  return globalThis[registryKey]
}

const fullTitle = (title) => {
  const suites = getRegistry().suites
  const names = suites.map((suite) => suite.title).filter(Boolean)
  return [...names, title].join(" > ")
}

const collectHooks = (kind) => {
  const suites = getRegistry().suites
  return suites.flatMap((suite) => suite[kind])
}

const registerTest = (title, fn, skip = false) => {
  const beforeEach = collectHooks("beforeEach")
  const afterEach = collectHooks("afterEach").slice().reverse()

  getRegistry().tests.push({
    title: fullTitle(title),
    fn,
    skip,
    beforeEach,
    afterEach,
  })
}

export const defineConfig = (...configs) => Object.assign({}, ...configs)

export const test = (title, fn) => {
  registerTest(title, fn)
}

test.describe = (title, callback) => {
  const registry = getRegistry()
  registry.suites.push({ title, beforeEach: [], afterEach: [] })

  try {
    callback()
  } finally {
    registry.suites.pop()
  }
}

test.beforeEach = (hook) => {
  const suites = getRegistry().suites
  suites[suites.length - 1].beforeEach.push(hook)
}

test.afterEach = (hook) => {
  const suites = getRegistry().suites
  suites[suites.length - 1].afterEach.push(hook)
}

test.skip = (title, fn) => {
  registerTest(title, fn, true)
}

test.setTimeout = () => {}

const matcherError = (name, received, expected, inverted) => {
  const operator = inverted ? "not." : ""
  return new Error(
    `expect(...).${operator}${name} failed\nReceived: ${inspect(received)}\nExpected: ${inspect(expected)}`
  )
}

const assertMatcher = (pass, name, received, expected, inverted) => {
  if (inverted ? pass : !pass) {
    throw matcherError(name, received, expected, inverted)
  }
}

const createMatchers = (actual, inverted = false) => {
  const api = {
    toBe: (expected) => {
      assertMatcher(Object.is(actual, expected), "toBe", actual, expected, inverted)
    },
    toEqual: (expected) => {
      assertMatcher(
        JSON.stringify(actual) === JSON.stringify(expected),
        "toEqual",
        actual,
        expected,
        inverted
      )
    },
    toContain: (expected) => {
      const pass =
        typeof actual === "string"
          ? actual.includes(expected)
          : Array.isArray(actual)
            ? actual.includes(expected)
            : false
      assertMatcher(pass, "toContain", actual, expected, inverted)
    },
    toMatch: (expected) => {
      const regex = expected instanceof RegExp ? expected : new RegExp(expected)
      assertMatcher(regex.test(String(actual)), "toMatch", actual, expected, inverted)
    },
    toBeTruthy: () => {
      assertMatcher(Boolean(actual), "toBeTruthy", actual, true, inverted)
    },
    toBeGreaterThan: (expected) => {
      assertMatcher(actual > expected, "toBeGreaterThan", actual, expected, inverted)
    },
    toBeGreaterThanOrEqual: (expected) => {
      assertMatcher(actual >= expected, "toBeGreaterThanOrEqual", actual, expected, inverted)
    },
  }

  Object.defineProperty(api, "not", {
    enumerable: true,
    get: () => createMatchers(actual, !inverted),
  })

  return api
}

export const expect = (actual) => createMatchers(actual)
expect.extend = () => {}

export const __getRegisteredTests = () => getRegistry().tests

export const __resetRegisteredTests = () => {
  globalThis[registryKey] = {
    suites: [{ title: "", beforeEach: [], afterEach: [] }],
    tests: [],
  }
}
