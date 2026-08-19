/**
 * RPW-branded PDF templates.
 *
 * Upstream stores one row per PDF template in the tenant's `pdf_templates`
 * table and renders whichever one the document points at. Our branded layout is
 * just another row — named with this prefix — so switching a document back to
 * upstream's stock design is a dropdown change, not a deployment.
 *
 * Keeping the check in one place means the branch in the invoice and estimate
 * PDF services stays a single line each, which is what makes those upstream
 * files easy to rebase.
 */
export const RPW_PDF_TEMPLATE_PREFIX = 'RPW';

/**
 * Whether the given template name belongs to an RPW-branded template.
 */
export function isRpwPdfTemplateName(templateName?: string | null): boolean {
  return Boolean(templateName?.startsWith(RPW_PDF_TEMPLATE_PREFIX));
}
