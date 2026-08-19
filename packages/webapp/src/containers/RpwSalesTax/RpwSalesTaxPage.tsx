// @ts-nocheck
import React from 'react';
import {
  Button,
  Callout,
  Classes,
  HTMLSelect,
  HTMLTable,
  Intent,
  Spinner,
  Switch,
  Tag,
} from '@blueprintjs/core';
import {
  useRpwCounties,
  useRpwCountySummary,
  useRpwSalesTaxSettings,
  useUpdateRpwCounty,
  useUpdateRpwSalesTaxSettings,
} from '@/hooks/query/rpw-sales-tax';
import { DashboardPageContent } from '@/components';

/**
 * Ohio multi-county sales tax (RPW).
 *
 * Rhodes Production Works is registered in Greene County but works jobs all
 * over the region, and Ohio wants each sale taxed at the job site's county rate
 * and reported to ODT county by county. This page is where the county rate
 * table lives, where a rate gets marked as checked against tax.ohio.gov, and
 * where collection eventually gets switched on.
 */
function currency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

function CountyRow({ county, isDefault, onChange }) {
  const verified = Boolean(county.verified_at ?? county.verifiedAt);
  const rate = Number(county.combined_rate ?? county.combinedRate);

  return (
    <tr>
      <td>
        {county.county_name ?? county.countyName}
        {isDefault && (
          <Tag minimal intent={Intent.PRIMARY} style={{ marginLeft: 8 }}>
            default
          </Tag>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>{rate.toFixed(2)}%</td>
      <td>
        {verified ? (
          <Tag minimal intent={Intent.SUCCESS}>
            checked against ODT
          </Tag>
        ) : (
          <Tag minimal intent={Intent.WARNING}>
            unverified
          </Tag>
        )}
      </td>
      <td>
        <Switch
          checked={Boolean(county.is_active ?? county.isActive)}
          label="In picker"
          style={{ marginBottom: 0 }}
          onChange={(event) =>
            onChange(county.id, { isActive: event.currentTarget.checked })
          }
        />
      </td>
      <td>
        <Button
          minimal
          small
          intent={verified ? Intent.NONE : Intent.SUCCESS}
          onClick={() => onChange(county.id, { verified: !verified })}
        >
          {verified ? 'Un-verify' : 'Mark verified'}
        </Button>
      </td>
    </tr>
  );
}

export function RpwSalesTaxPage() {
  const [showAll, setShowAll] = React.useState(false);
  const year = new Date().getFullYear();

  const { data: counties = [], isLoading } = useRpwCounties(false);
  const { data: settings = {} } = useRpwSalesTaxSettings();
  const { data: summary } = useRpwCountySummary(`${year}-01-01`, `${year}-12-31`);

  const { mutateAsync: updateCounty } = useUpdateRpwCounty();
  const { mutateAsync: updateSettings } = useUpdateRpwSalesTaxSettings();

  const [error, setError] = React.useState(null);

  const collectionEnabled = Boolean(
    settings.collection_enabled ?? settings.collectionEnabled,
  );
  const defaultCountyId = settings.default_county_id ?? settings.defaultCountyId;

  const activeCounties = counties.filter((c) => c.is_active ?? c.isActive);
  const unverifiedActive = activeCounties.filter(
    (c) => !(c.verified_at ?? c.verifiedAt),
  );
  const shown = showAll ? counties : activeCounties;

  const handleCountyChange = (id, values) => {
    setError(null);
    updateCounty([id, values]).catch((err) =>
      setError(err?.response?.data?.message || 'Could not update the county.'),
    );
  };

  const handleSettingsChange = (values) => {
    setError(null);
    updateSettings(values).catch((err) =>
      setError(
        err?.response?.data?.message ||
          'Could not update the sales tax settings.',
      ),
    );
  };

  if (isLoading) {
    return (
      <DashboardPageContent>
        <Spinner size={30} />
      </DashboardPageContent>
    );
  }

  return (
    <DashboardPageContent>
      <div style={{ padding: 24, maxWidth: 960 }}>
        <h2 style={{ marginTop: 0 }}>Ohio sales tax — by county</h2>

        {error && (
          <Callout intent={Intent.DANGER} style={{ marginBottom: 16 }}>
            {error}
          </Callout>
        )}

        <Callout
          intent={collectionEnabled ? Intent.SUCCESS : Intent.PRIMARY}
          style={{ marginBottom: 16 }}
        >
          <strong>
            Collection is {collectionEnabled ? 'ON' : 'OFF'}.
          </strong>{' '}
          {collectionEnabled
            ? 'Invoices can charge sales tax at the job-site county rate.'
            : 'No sales tax is charged on anything. Leave it off until the Ohio ' +
              "vendor's licence is approved."}
          <div style={{ marginTop: 12 }}>
            <Switch
              checked={collectionEnabled}
              label="Collect Ohio sales tax"
              disabled={!collectionEnabled && unverifiedActive.length > 0}
              onChange={(event) =>
                handleSettingsChange({
                  collectionEnabled: event.currentTarget.checked,
                })
              }
            />
            {!collectionEnabled && unverifiedActive.length > 0 && (
              <p className={Classes.TEXT_MUTED} style={{ marginBottom: 0 }}>
                Check each active county's rate against tax.ohio.gov and mark it
                verified first — {unverifiedActive.length} still unverified.
              </p>
            )}
          </div>
        </Callout>

        <div style={{ marginBottom: 16 }}>
          <label className={Classes.LABEL} style={{ marginBottom: 4 }}>
            Default job-site county
          </label>
          <HTMLSelect
            value={defaultCountyId || ''}
            onChange={(event) =>
              handleSettingsChange({
                defaultCountyId: Number(event.currentTarget.value),
              })
            }
          >
            <option value="">— none —</option>
            {activeCounties.map((county) => (
              <option key={county.id} value={county.id}>
                {county.county_name ?? county.countyName}
              </option>
            ))}
          </HTMLSelect>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3>Rate table</h3>
          <Button minimal small onClick={() => setShowAll(!showAll)}>
            {showAll
              ? 'Show only my counties'
              : `Show all ${counties.length} Ohio counties`}
          </Button>
        </div>

        <HTMLTable striped style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>County</th>
              <th style={{ textAlign: 'right' }}>Combined rate</th>
              <th>Rate checked?</th>
              <th>In picker</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((county) => (
              <CountyRow
                key={county.id}
                county={county}
                isDefault={county.id === defaultCountyId}
                onChange={handleCountyChange}
              />
            ))}
          </tbody>
        </HTMLTable>

        <p className={Classes.TEXT_MUTED} style={{ marginTop: 8 }}>
          Rates were loaded from the Ohio Department of Taxation's own rate
          table. ODT republishes it every quarter, so a rate that was right last
          quarter may not be right now — that is why nothing counts as verified
          until you have looked.
        </p>

        <h3 style={{ marginTop: 32 }}>Sales by county — {year}</h3>
        <HTMLTable striped style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>County</th>
              <th style={{ textAlign: 'right' }}>Invoices</th>
              <th style={{ textAlign: 'right' }}>Gross sales</th>
              <th style={{ textAlign: 'right' }}>Tax collected</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.rows || []).map((row) => (
              <tr key={row.countyId ?? row.county_id}>
                <td>{row.countyName ?? row.county_name}</td>
                <td style={{ textAlign: 'right' }}>
                  {row.invoiceCount ?? row.invoice_count}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {currency(row.grossSales ?? row.gross_sales)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {currency(row.taxCollected ?? row.tax_collected)}
                </td>
              </tr>
            ))}
            {(summary?.rows || []).length === 0 && (
              <tr>
                <td colSpan={4} className={Classes.TEXT_MUTED}>
                  No invoices have a job-site county recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </HTMLTable>

        {(summary?.unassignedInvoices ?? summary?.unassigned_invoices) > 0 && (
          <Callout intent={Intent.WARNING} style={{ marginTop: 12 }}>
            {summary.unassignedInvoices ?? summary.unassigned_invoices} delivered
            invoice(s) this year have no job-site county recorded, so they are
            missing from the table above.
          </Callout>
        )}

        {(summary?.caveats || []).map((caveat, index) => (
          <p key={index} className={Classes.TEXT_MUTED} style={{ marginTop: 4 }}>
            {caveat}
          </p>
        ))}
      </div>
    </DashboardPageContent>
  );
}
