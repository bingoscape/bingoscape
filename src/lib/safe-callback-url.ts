/**
 * Returns `raw` when it is a same-origin relative path, otherwise `fallback`.
 * Guards the sign-in `callbackUrl` param against open redirects: absolute URLs,
 * protocol-relative (`//evil.com`) and backslash tricks (`/\evil.com`) are
 * rejected.
 */
export function safeCallbackUrl(
  raw: string | string[] | null | undefined,
  fallback = "/"
): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || !value.startsWith("/")) return fallback
  if (value.startsWith("//") || value.includes("\\")) return fallback
  // Control characters can be stripped by browsers, turning "/\t/evil.com"
  // into "//evil.com".
   
  if (/[\u0000-\u001f]/.test(value)) return fallback
  return value
}
