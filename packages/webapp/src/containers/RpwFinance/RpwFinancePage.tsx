// @ts-nocheck
import React from 'react';
import {
  AnchorButton,
  Button,
  Callout,
  Classes,
  FileInput,
  HTMLSelect,
  HTMLTable,
  InputGroup,
  Intent,
  ProgressBar,
  Spinner,
  Tag,
} from '@blueprintjs/core';
import { DashboardPageContent } from '@/components';
import {
  useCreateRpwEquipment,
  useDeleteRpwEquipment,
  useRpwEquipmentReport,
  useRpwTaxCalendar,
  useRpwTaxReserve,
  useUploadBillOfSale,
} from '@/hooks/query/rpw-finance';

/**
 * Taxes & Reserve (RPW): the 25% discipline, the equipment register, and the
 * estimated-payment dates — the three things that keep tax season boring.
 */
const currency = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(value || 0),
  );

const pick = (obj, ...names) => {
  for (const name of names) {
    if (obj?.[name] !== undefined) return obj[name];
    const snake = name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    if (obj?.[snake] !== undefined) return obj[snake];
  }
  return undefined;
};

export function RpwFinancePage() {
  const year = new Date().getFullYear();
  const [error, setError] = React.useState(null);
  const [form, setForm] = React.useState({
    tag: 'section179',
    description: '',
    serialNumber: '',
    amount: '',
    purchasedOn: new Date().toISOString().slice(0, 10),
    vendorName: '',
  });
  const [billOfSale, setBillOfSale] = React.useState(null);

  const { data: reserve, isLoading } = useRpwTaxReserve();
  const { data: calendar = [] } = useRpwTaxCalendar();
  const { data: report } = useRpwEquipmentReport(year);

  const { mutateAsync: createEquipment } = useCreateRpwEquipment();
  const { mutateAsync: deleteEquipment } = useDeleteRpwEquipment();
  const uploadBillOfSale = useUploadBillOfSale();

  const run = (work) => {
    setError(null);
    work().catch((err) =>
      setError(err?.response?.data?.message || err?.message || 'Something went wrong.'),
    );
  };

  if (isLoading) {
    return (
      <DashboardPageContent>
        <Spinner size={30} />
      </DashboardPageContent>
    );
  }

  const target = pick(reserve, 'reserveTarget') ?? 0;
  const funded = pick(reserve, 'reserveFunded') ?? 0;
  const suggested = pick(reserve, 'suggestedTransfer') ?? 0;
  const profit = pick(reserve, 'ytdNetProfit') ?? 0;
  const rate = pick(reserve, 'reserveRatePercent') ?? 25;
  const fundedRatio = target > 0 ? Math.min(1, funded / target) : 1;
  const purchases = report?.purchases ?? [];

  return (
    <DashboardPageContent>
      <div style={{ padding: 24, maxWidth: 1000 }}>
        <h2 style={{ marginTop: 0 }}>Taxes &amp; Reserve</h2>

        {error && (
          <Callout intent={Intent.DANGER} style={{ marginBottom: 16 }}>
            {error}
          </Callout>
        )}

        {/* ── Reserve ── */}
        <Callout style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div className={Classes.TEXT_MUTED}>YTD net profit (cash)</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{currency(profit)}</div>
            </div>
            <div>
              <div className={Classes.TEXT_MUTED}>Reserve target ({rate}%)</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{currency(target)}</div>
            </div>
            <div>
              <div className={Classes.TEXT_MUTED}>In the reserve account</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{currency(funded)}</div>
            </div>
            <div>
              <div className={Classes.TEXT_MUTED}>Suggested transfer</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  color: suggested > 0 ? '#c23030' : '#0f9960',
                }}
              >
                {currency(suggested)}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, maxWidth: 480 }}>
            <ProgressBar
              value={fundedRatio}
              intent={fundedRatio >= 1 ? Intent.SUCCESS : Intent.PRIMARY}
              stripes={false}
            />
            <div className={Classes.TEXT_MUTED} style={{ marginTop: 4 }}>
              {Math.round(fundedRatio * 100)}% funded.{' '}
              {suggested > 0
                ? `Move ${currency(suggested)} to ${
                    pick(reserve, 'reserveAccountName') || 'the reserve account'
                  } to be square.`
                : 'The reserve covers the target.'}
            </div>
          </div>
          {(reserve?.caveats || []).map((caveat, index) => (
            <p key={index} className={Classes.TEXT_MUTED} style={{ marginTop: 8, marginBottom: 0 }}>
              {caveat}
            </p>
          ))}
        </Callout>

        {/* ── Estimated payments ── */}
        <h3>Estimated payments</h3>
        <HTMLTable striped style={{ marginBottom: 20 }}>
          <tbody>
            {calendar.map((deadline) => {
              const days = pick(deadline, 'daysAway');
              return (
                <tr key={deadline.date}>
                  <td>{deadline.label}</td>
                  <td>{deadline.date}</td>
                  <td>
                    <Tag
                      minimal
                      intent={days <= 14 ? Intent.WARNING : Intent.NONE}
                    >
                      in {days} days
                    </Tag>
                  </td>
                  <td>
                    {(deadline.links || []).map((link) => (
                      <AnchorButton
                        key={link.url}
                        small
                        minimal
                        href={link.url}
                        target="_blank"
                      >
                        {link.label}
                      </AnchorButton>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </HTMLTable>

        {/* ── Equipment register ── */}
        <h3>Equipment purchases — {year}</h3>
        <p className={Classes.TEXT_MUTED}>
          Section 179 or COGS, never bonus depreciation. Used gear needs the
          bill of sale attached and serials recorded — the report below counts
          what is missing.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            marginBottom: 16,
          }}
        >
          <HTMLSelect
            value={form.tag}
            onChange={(e) => setForm({ ...form, tag: e.currentTarget.value })}
          >
            <option value="section179">Section 179</option>
            <option value="cogs">COGS</option>
          </HTMLSelect>
          <InputGroup
            placeholder="What was bought"
            style={{ width: 220 }}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <InputGroup
            placeholder="Serial number(s)"
            style={{ width: 170 }}
            value={form.serialNumber}
            onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
          />
          <InputGroup
            placeholder="Amount"
            type="number"
            style={{ width: 110 }}
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <InputGroup
            type="date"
            value={form.purchasedOn}
            onChange={(e) => setForm({ ...form, purchasedOn: e.target.value })}
          />
          <InputGroup
            placeholder="Vendor"
            style={{ width: 160 }}
            value={form.vendorName}
            onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
          />
          <FileInput
            text={billOfSale ? billOfSale.name : 'Bill of sale…'}
            onInputChange={(e) => setBillOfSale(e.target.files?.[0] ?? null)}
          />
          <Button
            intent={Intent.PRIMARY}
            disabled={!form.description.trim() || !Number(form.amount)}
            onClick={() =>
              run(async () => {
                const attachmentKey = billOfSale
                  ? await uploadBillOfSale(billOfSale)
                  : undefined;
                await createEquipment({
                  ...form,
                  amount: Number(form.amount),
                  attachmentKey,
                });
                setForm({ ...form, description: '', serialNumber: '', amount: '' });
                setBillOfSale(null);
              })
            }
          >
            Register
          </Button>
        </div>

        <HTMLTable striped style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Serial</th>
              <th>Treatment</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Bill of sale</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => {
              const key = pick(purchase, 'attachmentKey');
              return (
                <tr key={purchase.id}>
                  <td>{pick(purchase, 'purchasedOn')}</td>
                  <td>
                    {purchase.description}
                    {pick(purchase, 'vendorName') && (
                      <div className={Classes.TEXT_MUTED}>
                        {pick(purchase, 'vendorName')}
                      </div>
                    )}
                  </td>
                  <td>{pick(purchase, 'serialNumber') || <Tag minimal intent={Intent.WARNING}>missing</Tag>}</td>
                  <td>
                    <Tag minimal>
                      {purchase.tag === 'section179' ? 'Sec. 179' : 'COGS'}
                    </Tag>
                  </td>
                  <td style={{ textAlign: 'right' }}>{currency(purchase.amount)}</td>
                  <td>
                    {key ? (
                      <AnchorButton
                        small
                        minimal
                        href={`/api/attachments/${encodeURIComponent(key)}`}
                        target="_blank"
                      >
                        View
                      </AnchorButton>
                    ) : (
                      <Tag minimal intent={Intent.WARNING}>missing</Tag>
                    )}
                  </td>
                  <td>
                    <Button
                      small
                      minimal
                      icon="trash"
                      onClick={() => run(() => deleteEquipment(purchase.id))}
                    />
                  </td>
                </tr>
              );
            })}
            {purchases.length === 0 && (
              <tr>
                <td colSpan={7} className={Classes.TEXT_MUTED}>
                  Nothing registered this year.
                </td>
              </tr>
            )}
          </tbody>
        </HTMLTable>

        {report && (
          <p className={Classes.TEXT_MUTED} style={{ marginTop: 8 }}>
            Sec. 179: {report.section179?.count ?? 0} item(s),{' '}
            {currency(report.section179?.total)} · COGS:{' '}
            {report.cogs?.count ?? 0} item(s), {currency(report.cogs?.total)}
          </p>
        )}
      </div>
    </DashboardPageContent>
  );
}
