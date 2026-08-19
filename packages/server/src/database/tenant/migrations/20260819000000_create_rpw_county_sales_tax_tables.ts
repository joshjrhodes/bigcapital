/**
 * RPW — Ohio multi-county sales tax scaffolding.
 *
 * Rhodes Production Works is based in Greene County but works jobs across
 * Montgomery and other surrounding counties. Under Ohio HB 508 the single
 * Greene County vendor's licence likely covers those temporary work locations,
 * but each sale must be taxed at the job site's combined county rate and
 * reported to ODT separated by county. That needs three things upstream does
 * not have: a per-county rate table, a job-site county recorded on each
 * transaction, and county-dimensioned reporting.
 *
 * Nothing here touches upstream tables or posting logic. The job-site county
 * lives in its own join table rather than as a column on SALES_INVOICES, so a
 * rebase against upstream can never conflict with it.
 *
 * The seeded rates come from the Ohio Department of Taxation's own rate table
 * (see source_url), not from memory and not from a rate-aggregator site — two
 * aggregators disagreed with ODT on Greene County. ODT republishes quarterly,
 * so every row lands UNVERIFIED: collection stays off until the vendor's
 * licence is approved and the rates are re-checked.
 *
 * Source of record for this data: rpw/data/ohio-county-tax-rates.json
 */

const SOURCE_URL =
  'https://www.tax.ohio.gov/wps/portal/gov/tax/business/sales-and-use-tax/rate-tables/by-county-q4-2025';
const EFFECTIVE_FROM = '2025-10-01';
const EFFECTIVE_TO = '2025-12-31';
const STATE_RATE = 5.75;

// [county name, ODT county code, combined rate %, county portion %, preloaded active]
const COUNTIES = [
  ['Adams', 1, 7.25, 1.5, false],
  ['Allen', 2, 6.85, 1.1, false],
  ['Ashland', 3, 7.0, 1.25, false],
  ['Ashtabula', 4, 6.75, 1.0, false],
  ['Athens', 5, 7.25, 1.5, false],
  ['Auglaize', 6, 7.25, 1.5, false],
  ['Belmont', 7, 7.25, 1.5, false],
  ['Brown', 8, 7.0, 1.25, false],
  ['Butler', 9, 6.5, 0.75, true],
  ['Carroll', 10, 6.75, 1.0, false],
  ['Champaign', 11, 7.25, 1.5, true],
  ['Clark', 12, 7.25, 1.5, true],
  ['Clermont', 13, 6.75, 1.0, false],
  ['Clinton', 14, 7.25, 1.5, true],
  ['Columbiana', 15, 7.25, 1.5, false],
  ['Coshocton', 16, 7.75, 2.0, false],
  ['Crawford', 17, 7.25, 1.5, false],
  ['Cuyahoga', 18, 8.0, 2.25, false],
  ['Darke', 19, 7.25, 1.5, true],
  ['Defiance', 20, 6.75, 1.0, false],
  ['Delaware', 21, 7.0, 1.25, false],
  ['Delaware (COTA)', 96, 8.0, 2.25, false],
  ['Erie', 22, 6.75, 1.0, false],
  ['Fairfield', 23, 6.75, 1.0, false],
  ['Fairfield (COTA)', 93, 7.75, 2.0, false],
  ['Fayette', 24, 7.25, 1.5, true],
  ['Franklin', 25, 8.0, 2.25, false],
  ['Fulton', 26, 7.25, 1.5, false],
  ['Gallia', 27, 7.25, 1.5, false],
  ['Geauga', 28, 6.75, 1.0, false],
  ['Greene', 29, 6.75, 1.0, true],
  ['Guernsey', 30, 7.25, 1.5, false],
  ['Hamilton', 31, 7.8, 2.05, false],
  ['Hancock', 32, 6.75, 1.0, false],
  ['Hardin', 33, 7.25, 1.5, false],
  ['Harrison', 34, 7.25, 1.5, false],
  ['Henry', 35, 7.25, 1.5, false],
  ['Highland', 36, 7.25, 1.5, false],
  ['Hocking', 37, 7.25, 1.5, false],
  ['Holmes', 38, 7.0, 1.25, false],
  ['Huron', 39, 7.25, 1.5, false],
  ['Jackson', 40, 7.25, 1.5, false],
  ['Jefferson', 41, 7.25, 1.5, false],
  ['Knox', 42, 7.25, 1.5, false],
  ['Lake', 43, 7.25, 1.5, false],
  ['Lawrence', 44, 7.25, 1.5, false],
  ['Licking', 45, 7.25, 1.5, false],
  ['Licking (COTA)', 94, 8.25, 2.5, false],
  ['Logan', 46, 7.25, 1.5, false],
  ['Lorain', 47, 6.5, 0.75, false],
  ['Lucas', 48, 7.75, 2.0, false],
  ['Madison', 49, 7.0, 1.25, true],
  ['Mahoning', 50, 7.5, 1.75, false],
  ['Marion', 51, 7.25, 1.5, false],
  ['Medina', 52, 6.75, 1.0, false],
  ['Meigs', 53, 7.25, 1.5, false],
  ['Mercer', 54, 7.25, 1.5, false],
  ['Miami', 55, 7.0, 1.25, true],
  ['Monroe', 56, 7.25, 1.5, false],
  ['Montgomery', 57, 7.5, 1.75, true],
  ['Morgan', 58, 7.25, 1.5, false],
  ['Morrow', 59, 7.25, 1.5, false],
  ['Muskingum', 60, 7.25, 1.5, false],
  ['Noble', 61, 7.25, 1.5, false],
  ['Ottawa', 62, 7.0, 1.25, false],
  ['Paulding', 63, 7.25, 1.5, false],
  ['Perry', 64, 7.25, 1.5, false],
  ['Pickaway', 65, 7.25, 1.5, false],
  ['Pike', 66, 7.25, 1.5, false],
  ['Portage', 67, 7.0, 1.25, false],
  ['Preble', 68, 7.25, 1.5, true],
  ['Putnam', 69, 7.0, 1.25, false],
  ['Richland', 70, 7.0, 1.25, false],
  ['Ross', 71, 7.25, 1.5, false],
  ['Sandusky', 72, 7.25, 1.5, false],
  ['Scioto', 73, 7.25, 1.5, false],
  ['Seneca', 74, 7.25, 1.5, false],
  ['Shelby', 75, 7.25, 1.5, false],
  ['Stark', 76, 6.5, 0.75, false],
  ['Summit', 77, 6.75, 1.0, false],
  ['Trumbull', 78, 6.75, 1.0, false],
  ['Tuscarawas', 79, 6.75, 1.0, false],
  ['Union', 80, 7.0, 1.25, false],
  ['Union (COTA)', 98, 8.0, 2.25, false],
  ['Van Wert', 81, 7.25, 1.5, false],
  ['Vinton', 82, 7.25, 1.5, false],
  ['Warren', 83, 6.75, 1.0, true],
  ['Washington', 84, 7.25, 1.5, false],
  ['Wayne', 85, 6.5, 0.75, false],
  ['Williams', 86, 7.25, 1.5, false],
  ['Wood', 87, 6.75, 1.0, false],
  ['Wyandot', 88, 7.25, 1.5, false],
];

exports.up = async (knex) => {
  await knex.schema.createTable('rpw_county_tax_rates', (table) => {
    table.increments('id').primary();
    table.string('county_name', 64).notNullable().unique();
    table.integer('odt_code').unsigned().nullable();
    // Percentages, e.g. 6.7500 means 6.75%.
    table.decimal('combined_rate', 6, 4).notNullable();
    table.decimal('county_rate', 6, 4).notNullable();
    table.decimal('state_rate', 6, 4).notNullable();
    table.string('source_url', 512).nullable();
    table.date('effective_from').nullable();
    table.date('effective_to').nullable();
    // Inactive counties still exist so the picker is complete; the active ones
    // are the short list Josh actually works in.
    table.boolean('is_active').notNullable().defaultTo(false);
    // Null until a human has checked the rate against tax.ohio.gov. Collection
    // must not be switched on for an unverified county.
    table.datetime('verified_at').nullable();
    table.string('verified_by', 128).nullable();
    table.timestamps(false, true);

    table.index(['is_active']);
  });

  await knex.schema.createTable('rpw_transaction_counties', (table) => {
    table.increments('id').primary();
    // 'SaleInvoice' | 'SaleEstimate' — a string so new document types need no
    // schema change.
    table.string('transaction_type', 32).notNullable();
    table.integer('transaction_id').unsigned().notNullable();
    table.integer('county_id').unsigned().notNullable();
    table.timestamps(false, true);

    table.unique(['transaction_type', 'transaction_id']);
    table.index(['county_id']);
  });

  const now = knex.fn.now();

  await knex('rpw_county_tax_rates').insert(
    COUNTIES.map(([name, code, combined, county, active]) => ({
      // camelCase keys on purpose: the knex instance uses
      // knexSnakeCaseMappers({ upperCase: true }), so these land as
      // COUNTY_NAME, ODT_CODE, … exactly like upstream's seed migrations.
      countyName: name,
      odtCode: code,
      combinedRate: combined,
      countyRate: county,
      stateRate: STATE_RATE,
      sourceUrl: SOURCE_URL,
      effectiveFrom: EFFECTIVE_FROM,
      effectiveTo: EFFECTIVE_TO,
      isActive: active,
      verifiedAt: null,
      verifiedBy: null,
      createdAt: now,
      updatedAt: now,
    })),
  );
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('rpw_transaction_counties');
  await knex.schema.dropTableIfExists('rpw_county_tax_rates');
};
