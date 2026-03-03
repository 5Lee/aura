declare module "@playwright/test" {
  export type PlaywrightFixtures = {
    page: {
      goto(url: string): Promise<{
        status(): number
        ok(): boolean
        url(): string
        text(): Promise<string>
      }>
      content(): Promise<string>
      url(): string
      screenshot(options?: { path?: string } | string): Promise<Buffer>
    }
    baseURL?: string
  }

  export type TestCallback = (fixtures: PlaywrightFixtures) => void | Promise<void>

  export type TestType = {
    (title: string, callback: TestCallback): void
    describe(title: string, callback: () => void): void
    beforeEach(callback: TestCallback): void
    afterEach(callback: TestCallback): void
    skip(title: string, callback: TestCallback): void
    setTimeout(timeout: number): void
  }

  export const test: TestType

  export function expect(actual: unknown): {
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toContain(expected: unknown): void
    toMatch(expected: RegExp | string): void
    toBeTruthy(): void
    toBeGreaterThan(expected: number): void
    toBeGreaterThanOrEqual(expected: number): void
    not: {
      toBe(expected: unknown): void
      toEqual(expected: unknown): void
      toContain(expected: unknown): void
      toMatch(expected: RegExp | string): void
      toBeTruthy(): void
      toBeGreaterThan(expected: number): void
      toBeGreaterThanOrEqual(expected: number): void
    }
  }

  export function defineConfig<T extends Record<string, unknown>>(...configs: T[]): T
}
