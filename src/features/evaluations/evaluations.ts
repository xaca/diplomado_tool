const FORMS_PUBLISHED_RE =
  /docs\.google\.com\/forms\/d\/e\/([A-Za-z0-9_-]{20,80})/
const FORMS_STANDARD_RE = /docs\.google\.com\/forms\/d\/([A-Za-z0-9_-]{20,80})/

export function parseFormsUrl(
  url: string,
): { formId: string; published: boolean } | null {
  const pub = FORMS_PUBLISHED_RE.exec(url)
  if (pub) return { formId: pub[1], published: true }
  const std = FORMS_STANDARD_RE.exec(url)
  if (std) return { formId: std[1], published: false }
  return null
}

function basePath(formId: string, published: boolean): string {
  return published
    ? `https://docs.google.com/forms/d/e/${formId}`
    : `https://docs.google.com/forms/d/${formId}`
}

export function embedFormUrl(formId: string, published: boolean): string {
  return `${basePath(formId, published)}/viewform?embedded=true`
}

export function viewFormUrl(formId: string, published: boolean): string {
  return `${basePath(formId, published)}/viewform`
}

export function editFormUrl(formId: string): string {
  return `https://docs.google.com/forms/d/${formId}/edit`
}
