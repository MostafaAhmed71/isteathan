/** Fold Arabic letters so أ/ا/إ/آ and ي/ى match in search. */
export function foldArabic(raw: string): string {
  return String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // tashkeel + tatweel
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** True if `haystack` contains every whitespace-separated token of `needle` (order-independent partial). */
export function arabicNameMatches(haystack: string, needle: string): boolean {
  const h = foldArabic(haystack)
  const n = foldArabic(needle)
  if (!n) return true
  if (!h) return false
  if (h.includes(n)) return true
  const tokens = n.split(' ').filter(Boolean)
  return tokens.every((t) => h.includes(t))
}
