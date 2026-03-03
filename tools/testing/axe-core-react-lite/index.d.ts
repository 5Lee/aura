export interface AxeLiteOptions {
  silent?: boolean
}

declare function axeLite(
  react: unknown,
  reactDom: unknown,
  timeout?: number,
  options?: AxeLiteOptions
): Promise<void>

export default axeLite
