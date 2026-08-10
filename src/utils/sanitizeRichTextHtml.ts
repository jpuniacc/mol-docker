import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'a',
  'br',
  'blockquote',
] as const

export function sanitizeRichTextHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
  if (typeof window === 'undefined') return clean
  const doc = new DOMParser().parseFromString(clean, 'text/html')
  doc.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
  })
  return doc.body.innerHTML
}

export function isRichTextHtmlEmpty(html: string): boolean {
  const text = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).trim()
  return text.length === 0
}
