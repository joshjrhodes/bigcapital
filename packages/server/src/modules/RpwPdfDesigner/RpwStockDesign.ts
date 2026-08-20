/**
 * The Phase 1 stock layout, expressed as a pdfme template.
 *
 * This is the starting point Josh duplicates and edits rather than facing an
 * empty page. It deliberately mirrors the React template's proportions —
 * lockup top-left, document type large on the right, hairline-ruled item table,
 * totals under it, terms in the footer — so switching a document from the coded
 * template to a designed one is not a visual jolt.
 *
 * Units are millimetres on US Letter (215.9 x 279.4), 18mm margins.
 *
 * `basePdf` is an object rather than a fixed PDF, which puts pdfme in dynamic
 * layout mode: when the item table grows, everything below it moves down
 * instead of being written over.
 */

const INK = '#141414';
const MUTED = '#6b6b6b';
const RULE = '#141414';

const PAGE = { width: 215.9, height: 279.4, padding: [18, 18, 18, 18] as [number, number, number, number] };
const LEFT = 18;
const RIGHT_COL_X = 128;
const CONTENT_WIDTH = 179.9;

/** A small tracked uppercase label, matching the printed template's voice. */
const label = (name: string, text: string, x: number, y: number, width: number, alignment = 'left') => ({
  name,
  type: 'text',
  content: text,
  position: { x, y },
  width,
  height: 4,
  fontSize: 7,
  characterSpacing: 1.2,
  fontColor: MUTED,
  alignment,
  readOnly: true,
});

const value = (
  name: string,
  content: string,
  x: number,
  y: number,
  width: number,
  extra: Record<string, any> = {},
) => ({
  name,
  type: 'text',
  content,
  position: { x, y },
  width,
  height: extra.height ?? 5,
  fontSize: extra.fontSize ?? 9,
  fontColor: extra.fontColor ?? INK,
  alignment: extra.alignment ?? 'left',
  ...extra,
});

export function buildRpwStockDesign(resource: 'SaleInvoice' | 'SaleEstimate') {
  const isEstimate = resource === 'SaleEstimate';
  const title = isEstimate ? 'ESTIMATE' : 'INVOICE';
  const numberLabel = isEstimate ? 'ESTIMATE NO.' : 'INVOICE NO.';
  const secondDateLabel = isEstimate ? 'VALID UNTIL' : 'PAYMENT DUE';

  const schemas = [
    // ── Header ──────────────────────────────────────────────────────────
    {
      name: 'logo',
      type: 'image',
      content: '',
      position: { x: LEFT, y: 16 },
      width: 52,
      height: 25,
    },
    value('company_address', '', LEFT, 44, 70, { fontSize: 8, fontColor: MUTED, height: 14 }),

    value('doc_title', title, RIGHT_COL_X, 16, 70, {
      fontSize: 24,
      alignment: 'right',
      characterSpacing: 2.5,
      height: 11,
      readOnly: true,
    }),
    label('doc_number_label', numberLabel, RIGHT_COL_X, 32, 70, 'right'),
    value('doc_number', '', RIGHT_COL_X, 36, 70, { alignment: 'right' }),
    label('doc_date_label', 'DATE ISSUED', RIGHT_COL_X, 43, 70, 'right'),
    value('doc_date', '', RIGHT_COL_X, 47, 70, { alignment: 'right' }),
    label('doc_second_date_label', secondDateLabel, RIGHT_COL_X, 54, 70, 'right'),
    value('doc_second_date', '', RIGHT_COL_X, 58, 70, { alignment: 'right' }),

    {
      name: 'header_rule',
      type: 'line',
      position: { x: LEFT, y: 68 },
      width: CONTENT_WIDTH,
      height: 0.7,
      color: RULE,
      readOnly: true,
    },

    // ── Billed to ───────────────────────────────────────────────────────
    label('bill_to_label', isEstimate ? 'PREPARED FOR' : 'BILLED TO', LEFT, 73, 90),
    value('bill_to', '', LEFT, 78, 90, { height: 18, fontSize: 9 }),
    label('job_county_label', 'JOB SITE COUNTY', RIGHT_COL_X, 73, 70, 'right'),
    value('job_county', '', RIGHT_COL_X, 78, 70, { alignment: 'right' }),

    // ── Line items ──────────────────────────────────────────────────────
    {
      name: 'items',
      type: 'table',
      position: { x: LEFT, y: 100 },
      width: CONTENT_WIDTH,
      height: 40,
      content: '[["",""]]',
      showHead: true,
      head: ['Description', 'Qty', 'Rate', 'Amount'],
      headWidthPercentages: [55, 10, 16, 19],
      tableStyles: { borderWidth: 0, borderColor: '#ffffff' },
      headStyles: {
        fontSize: 7,
        characterSpacing: 1.2,
        fontColor: MUTED,
        backgroundColor: '',
        borderColor: RULE,
        borderWidth: { top: 0, right: 0, bottom: 0.5, left: 0 },
        padding: { top: 2, right: 2, bottom: 2, left: 0 },
      },
      bodyStyles: {
        fontSize: 9,
        fontColor: INK,
        borderColor: '#d8d5d0',
        borderWidth: { top: 0, right: 0, bottom: 0.25, left: 0 },
        padding: { top: 3, right: 2, bottom: 3, left: 0 },
        alternateBackgroundColor: '',
      },
      columnStyles: { alignment: { '1': 'right', '2': 'right', '3': 'right' } },
    },

    // ── Totals (pushed down by the table in dynamic layout) ─────────────
    label('subtotal_label', 'SUBTOTAL', 118, 150, 40, 'right'),
    value('subtotal', '', 160, 150, 38, { alignment: 'right' }),
    label('tax_label', 'TAX', 118, 156, 40, 'right'),
    value('tax', '', 160, 156, 38, { alignment: 'right' }),
    {
      name: 'total_rule',
      type: 'line',
      position: { x: 118, y: 163 },
      width: 80,
      height: 0.5,
      color: RULE,
      readOnly: true,
    },
    label('total_label', 'TOTAL', 118, 166, 40, 'right'),
    value('total', '', 150, 165, 48, { alignment: 'right', fontSize: 13 }),
    label('amount_due_label', isEstimate ? '' : 'AMOUNT DUE', 118, 175, 40, 'right'),
    value('amount_due', '', 160, 175, 38, { alignment: 'right' }),

    // ── Footer ──────────────────────────────────────────────────────────
    label('notes_label', 'NOTES', LEFT, 195, 85),
    value('notes', '', LEFT, 200, 85, { fontSize: 8, fontColor: MUTED, height: 16 }),
    label('terms_label', 'TERMS', 110, 195, 88),
    value('terms', '', 110, 200, 88, { fontSize: 8, fontColor: MUTED, height: 16 }),
    {
      name: 'footer_rule',
      type: 'line',
      position: { x: LEFT, y: 224 },
      width: CONTENT_WIDTH,
      height: 0.7,
      color: '#8a7a5c',
      readOnly: true,
    },
    value(
      'footer',
      'LIGHTING · AUDIO · VIDEO — PRODUCTION, SALES & INSTALLATION',
      LEFT,
      227,
      CONTENT_WIDTH,
      { fontSize: 6.5, characterSpacing: 1.6, fontColor: MUTED },
    ),
  ];

  return {
    basePdf: PAGE,
    schemas: [schemas],
  };
}
