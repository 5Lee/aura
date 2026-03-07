import { hashIpAddress } from "@/lib/compliance-audit"
import { sanitizeTextInput } from "@/lib/security"

export type RequestLikeHeaders = Headers | Record<string, string | string[] | undefined> | null | undefined
export type RequestLike =
  | Request
  | {
      headers?: RequestLikeHeaders
    }
  | null
  | undefined

function normalizeHeaderValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return sanitizeTextInput(value[0], 260)
  }

  return sanitizeTextInput(value, 260)
}

export function getRequestHeaderValue(request: RequestLike, name: string) {
  if (!request) {
    return ""
  }

  if (request instanceof Request) {
    return sanitizeTextInput(request.headers.get(name), 260)
  }

  const headers = request.headers
  if (!headers) {
    return ""
  }

  if (headers instanceof Headers) {
    return sanitizeTextInput(headers.get(name), 260)
  }

  const normalizedName = name.toLowerCase()
  return normalizeHeaderValue(headers[normalizedName] ?? headers[name])
}

export function getRequestIpAddress(request: RequestLike) {
  const forwardedFor = getRequestHeaderValue(request, "x-forwarded-for")
  const realIp = getRequestHeaderValue(request, "x-real-ip")
  return forwardedFor.split(",")[0]?.trim() || realIp
}

export function getRequestIpHash(request: RequestLike) {
  const ipAddress = getRequestIpAddress(request)
  return ipAddress ? hashIpAddress(ipAddress) : ""
}

export function getRequestUserAgent(request: RequestLike) {
  return getRequestHeaderValue(request, "user-agent")
}
