/**
 * RPW — equipment purchase register (Phase 5).
 *
 * Josh expenses equipment under Section 179 or COGS — never bonus depreciation
 * (Ohio addback) — and used-equipment purchases need a bill of sale with serial
 * numbers on record. This table is that record: an audit- and CPA-ready
 * register, in our own table so no upstream line-item schema changes.
 *
 * Rows can reference the expense or bill they were paid through, but do not
 * have to — a purchase can be registered before its paperwork is entered.
 */

exports.up = async (knex) => {
  await knex.schema.createTable('rpw_equipment_purchases', (table) => {
    table.increments('id').primary();
    // 'section179' | 'cogs' — the CPA-relevant treatment.
    table.string('tag', 16).notNullable();
    table.string('description', 255).notNullable();
    table.string('serial_number', 128).nullable();
    table.decimal('amount', 13, 3).notNullable();
    table.date('purchased_on').notNullable();
    table.string('vendor_name', 255).nullable();
    // Optional link to the accounting document that paid for it.
    table.string('reference_type', 32).nullable();
    table.integer('reference_id').unsigned().nullable();
    // Object-storage key of the bill of sale (uploaded via /attachments).
    table.string('attachment_key', 255).nullable();
    table.string('notes', 500).nullable();
    table.timestamps(false, true);

    table.index(['purchased_on']);
    table.index(['tag']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('rpw_equipment_purchases');
};
