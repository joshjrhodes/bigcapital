import { InvoicePaperTemplateProps } from './InvoicePaperTemplate';

/**
 * Rhodes Production Works — stock estimate/invoice layout (Phase 1).
 *
 * Industrial, honest, "boots on the ground": a stamped maker's-plate monogram,
 * hairline rules, tracked uppercase labels and tabular figures. It takes the
 * same props object as upstream's InvoicePaperTemplate, so the server can hand
 * it the branding attributes unchanged.
 *
 * PLACEHOLDERS, to be swapped once Josh supplies the assets:
 *   * The monogram is drawn in CSS. Set `companyLogoUri` and it is used instead.
 *   * Display face is DDC Hardware 45 with Oswald as a stand-in; body face is
 *     Avenir with Nunito Sans as a stand-in. Both real faces are named first in
 *     the stack, so installing/embedding them is all that is needed to switch.
 * Swapping either changes the texture of the page, not its structure.
 */

export interface RpwPaperTemplateProps extends InvoicePaperTemplateProps {
  /** Drives the big word in the header and a couple of labels. */
  documentKind?: 'invoice' | 'estimate';
  /** Ohio job-site county, shown once sales tax collection is switched on. */
  jobSiteCounty?: string;
  showJobSiteCounty?: boolean;
  /** Footer descriptor line. Editable so the wording is not baked into code. */
  footerTagline?: string;
  showFooterTagline?: boolean;
}

const INK = '#141414';
const RULE = '#141414';
const MUTED = '#6b6b6b';
const HAIRLINE = '#d8d5d0';

const displayFont =
  "'DDC Hardware 45', 'Oswald', 'Arial Narrow', 'Helvetica Neue', sans-serif";
const bodyFont =
  "'Avenir', 'Avenir Next', 'Nunito Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

const label: React.CSSProperties = {
  fontFamily: displayFont,
  fontSize: 8.5,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: MUTED,
  fontWeight: 500,
};

const numeric: React.CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
  whiteSpace: 'nowrap',
};

/**
 * The maker's-plate mark: a stamped metal plate with the RPW monogram and four
 * rivets. Stands in for the real logo file.
 */
function MakersPlate({ accent }: { accent: string }) {
  const rivet: React.CSSProperties = {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: '50%',
    background: accent,
    opacity: 0.55,
  };
  return (
    <div
      style={{
        position: 'relative',
        width: 74,
        height: 74,
        border: `2px solid ${accent}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 4,
          border: `0.75px solid ${accent}`,
          opacity: 0.45,
        }}
      />
      <span style={rivet as any} />
      <span style={{ ...rivet, top: 7, left: 7 } as any} />
      <span style={{ ...rivet, top: 7, right: 7 } as any} />
      <span style={{ ...rivet, bottom: 7, left: 7 } as any} />
      <span style={{ ...rivet, bottom: 7, right: 7 } as any} />
      <span
        style={{
          fontFamily: displayFont,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: accent,
          lineHeight: 1,
        }}
      >
        RPW
      </span>
    </div>
  );
}

function Field({
  label: text,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={label as any}>{text}</div>
      <div style={{ fontSize: 10.5, color: INK, marginTop: 1 }}>{value}</div>
    </div>
  );
}

export function RpwPaperTemplate({
  documentKind = 'invoice',
  primaryColor = '#141414',
  secondaryColor = '#8a7a5c',

  companyName = 'Rhodes Production Works LTD',
  showCompanyLogo = true,
  companyLogoUri = '',

  showCompanyAddress = true,
  companyAddress = '',

  showCustomerAddress = true,
  customerAddress = '',
  billedToLabel = 'Billed to',

  showInvoiceNumber = true,
  invoiceNumber = '',
  invoiceNumberLabel,

  showDateIssue = true,
  dateIssue = '',
  dateIssueLabel = 'Date issued',

  showDueDate = true,
  dueDate = '',
  dueDateLabel,

  jobSiteCounty = '',
  showJobSiteCounty = false,

  lineItemLabel = 'Description',
  lineQuantityLabel = 'Qty',
  lineRateLabel = 'Rate',
  lineTotalLabel = 'Amount',

  showSubtotal = true,
  subtotalLabel = 'Subtotal',
  subtotal = '',

  showDiscount = false,
  discountLabel = 'Discount',
  discount = '',

  showAdjustment = false,
  adjustmentLabel = 'Adjustment',
  adjustment = '',

  showTaxes = true,
  taxes = [],

  showTotal = true,
  totalLabel = 'Total',
  total = '',

  showPaymentMade = true,
  paymentMadeLabel = 'Payment made',
  paymentMade = '',

  showDueAmount = true,
  dueAmountLabel = 'Amount due',
  dueAmount = '',

  showTermsConditions = true,
  termsConditionsLabel = 'Terms & conditions',
  termsConditions = '',

  showStatement = true,
  statementLabel = 'Notes',
  statement = '',

  footerTagline = 'Lighting · Audio · Video — Production, Sales & Installation',
  showFooterTagline = true,

  lines = [],
}: RpwPaperTemplateProps) {
  const isEstimate = documentKind === 'estimate';
  const title = isEstimate ? 'Estimate' : 'Invoice';
  const numberLabel =
    invoiceNumberLabel ?? (isEstimate ? 'Estimate no.' : 'Invoice no.');
  const secondDateLabel =
    dueDateLabel ?? (isEstimate ? 'Valid until' : 'Payment due');

  return (
    <div
      style={{
        fontFamily: bodyFont,
        color: INK,
        fontSize: 10.5,
        lineHeight: 1.5,
        padding: '48px 52px',
        background: '#fff',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {showCompanyLogo && !companyLogoUri && (
            <MakersPlate accent={primaryColor} />
          )}
          <div>
            {showCompanyLogo && companyLogoUri ? (
              // The supplied lockup already reads "RHODES PRODUCTION WORKS", so
              // it stands in for the typeset company name rather than sitting
              // next to it. max-width/max-height with contain means a wide
              // lockup, a square plate or a tall mark all sit correctly without
              // the layout caring which arrived.
              <img
                src={companyLogoUri}
                alt={companyName}
                style={{
                  maxWidth: 200,
                  maxHeight: 78,
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  fontFamily: displayFont,
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  lineHeight: 1.2,
                }}
              >
                {companyName}
              </div>
            )}
            {showCompanyAddress && companyAddress && (
              <div
                style={{
                  fontSize: 9.5,
                  color: MUTED,
                  marginTop: 6,
                  maxWidth: 220,
                }}
                dangerouslySetInnerHTML={{ __html: companyAddress }}
              />
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', minWidth: 190 }}>
          <div
            style={{
              fontFamily: displayFont,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              lineHeight: 1,
              color: primaryColor,
            }}
          >
            {title}
          </div>
          <div style={{ marginTop: 12 }}>
            {showInvoiceNumber && invoiceNumber && (
              <div style={{ marginBottom: 4 }}>
                <span style={label as any}>{numberLabel} </span>
                <span style={{ fontSize: 10.5 }}>{invoiceNumber}</span>
              </div>
            )}
            {showDateIssue && dateIssue && (
              <div style={{ marginBottom: 4 }}>
                <span style={label as any}>{dateIssueLabel} </span>
                <span style={{ fontSize: 10.5 }}>{dateIssue}</span>
              </div>
            )}
            {showDueDate && dueDate && (
              <div>
                <span style={label as any}>{secondDateLabel} </span>
                <span style={{ fontSize: 10.5 }}>{dueDate}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: `2px solid ${RULE}`,
          marginTop: 20,
          marginBottom: 20,
        }}
      />

      {/* ── Parties ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 40, marginBottom: 26 }}>
        {showCustomerAddress && customerAddress && (
          <div style={{ flex: 1 }}>
            <div style={label as any}>{billedToLabel}</div>
            <div
              style={{ marginTop: 3 }}
              dangerouslySetInnerHTML={{ __html: customerAddress }}
            />
          </div>
        )}
        {showJobSiteCounty && jobSiteCounty && (
          <div style={{ flex: 1 }}>
            <Field label="Job site county" value={`${jobSiteCounty}, Ohio`} />
          </div>
        )}
      </div>

      {/* ── Line items ─────────────────────────────────────────────────── */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: 18,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                ...(label as any),
                textAlign: 'left',
                padding: '0 0 6px',
                borderBottom: `1.5px solid ${RULE}`,
              }}
            >
              {lineItemLabel}
            </th>
            <th
              style={{
                ...(label as any),
                ...numeric,
                padding: '0 0 6px 12px',
                borderBottom: `1.5px solid ${RULE}`,
                width: 60,
              }}
            >
              {lineQuantityLabel}
            </th>
            <th
              style={{
                ...(label as any),
                ...numeric,
                padding: '0 0 6px 12px',
                borderBottom: `1.5px solid ${RULE}`,
                width: 90,
              }}
            >
              {lineRateLabel}
            </th>
            <th
              style={{
                ...(label as any),
                ...numeric,
                padding: '0 0 6px 12px',
                borderBottom: `1.5px solid ${RULE}`,
                width: 100,
              }}
            >
              {lineTotalLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={index}>
              <td
                style={{
                  padding: '9px 0',
                  borderBottom: `0.75px solid ${HAIRLINE}`,
                  verticalAlign: 'top',
                }}
              >
                <div style={{ fontWeight: 600 }}>{line.item}</div>
                {line.description && (
                  <div style={{ color: MUTED, fontSize: 9.5, marginTop: 1 }}>
                    {line.description}
                  </div>
                )}
              </td>
              <td
                style={{
                  ...numeric,
                  padding: '9px 0 9px 12px',
                  borderBottom: `0.75px solid ${HAIRLINE}`,
                  verticalAlign: 'top',
                }}
              >
                {line.quantity}
              </td>
              <td
                style={{
                  ...numeric,
                  padding: '9px 0 9px 12px',
                  borderBottom: `0.75px solid ${HAIRLINE}`,
                  verticalAlign: 'top',
                }}
              >
                {line.rate}
              </td>
              <td
                style={{
                  ...numeric,
                  padding: '9px 0 9px 12px',
                  borderBottom: `0.75px solid ${HAIRLINE}`,
                  verticalAlign: 'top',
                }}
              >
                {line.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 260 }}>
          <tbody>
            {showSubtotal && (
              <tr>
                <td style={{ ...(label as any), padding: '4px 16px 4px 0' }}>
                  {subtotalLabel}
                </td>
                <td style={{ ...numeric, padding: '4px 0' }}>{subtotal}</td>
              </tr>
            )}
            {showDiscount && discount && (
              <tr>
                <td style={{ ...(label as any), padding: '4px 16px 4px 0' }}>
                  {discountLabel}
                </td>
                <td style={{ ...numeric, padding: '4px 0' }}>{discount}</td>
              </tr>
            )}
            {showAdjustment && adjustment && (
              <tr>
                <td style={{ ...(label as any), padding: '4px 16px 4px 0' }}>
                  {adjustmentLabel}
                </td>
                <td style={{ ...numeric, padding: '4px 0' }}>{adjustment}</td>
              </tr>
            )}
            {showTaxes &&
              taxes.map((tax, index) => (
                <tr key={index}>
                  <td style={{ ...(label as any), padding: '4px 16px 4px 0' }}>
                    {tax.label}
                  </td>
                  <td style={{ ...numeric, padding: '4px 0' }}>{tax.amount}</td>
                </tr>
              ))}
            {showTotal && (
              <tr>
                <td
                  style={{
                    ...(label as any),
                    color: INK,
                    fontSize: 9.5,
                    padding: '8px 16px 8px 0',
                    borderTop: `1.5px solid ${RULE}`,
                  }}
                >
                  {totalLabel}
                </td>
                <td
                  style={{
                    ...numeric,
                    padding: '8px 0',
                    borderTop: `1.5px solid ${RULE}`,
                    fontFamily: displayFont,
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  {total}
                </td>
              </tr>
            )}
            {showPaymentMade && paymentMade && (
              <tr>
                <td style={{ ...(label as any), padding: '4px 16px 4px 0' }}>
                  {paymentMadeLabel}
                </td>
                <td style={{ ...numeric, padding: '4px 0' }}>{paymentMade}</td>
              </tr>
            )}
            {showDueAmount && dueAmount && !isEstimate && (
              <tr>
                <td
                  style={{
                    ...(label as any),
                    color: INK,
                    padding: '4px 16px 4px 0',
                  }}
                >
                  {dueAmountLabel}
                </td>
                <td style={{ ...numeric, padding: '4px 0', fontWeight: 700 }}>
                  {dueAmount}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      {((showStatement && statement) ||
        (showTermsConditions && termsConditions)) && (
        <div
          style={{
            marginTop: 34,
            paddingTop: 14,
            borderTop: `0.75px solid ${HAIRLINE}`,
            display: 'flex',
            gap: 40,
          }}
        >
          {showStatement && statement && (
            <div style={{ flex: 1 }}>
              <div style={label as any}>{statementLabel}</div>
              <div style={{ fontSize: 9.5, color: MUTED, marginTop: 3 }}>
                {statement}
              </div>
            </div>
          )}
          {showTermsConditions && termsConditions && (
            <div style={{ flex: 1 }}>
              <div style={label as any}>{termsConditionsLabel}</div>
              <div style={{ fontSize: 9.5, color: MUTED, marginTop: 3 }}>
                {termsConditions}
              </div>
            </div>
          )}
        </div>
      )}

      {showFooterTagline && footerTagline && (
        <div
          style={{
            marginTop: 26,
            paddingTop: 8,
            borderTop: `2px solid ${secondaryColor}`,
            ...(label as any),
            fontSize: 8,
            letterSpacing: '0.18em',
          }}
        >
          {footerTagline}
        </div>
      )}
    </div>
  );
}
