/**
 * RPW — lightweight CRM layer (Phase 4).
 *
 * Relationship memory and follow-through, not a sales machine: notes against a
 * customer, a timeline of what has already happened with them, and follow-ups
 * that surface when they are due.
 *
 * Everything hangs off `contacts.id` by foreign key and nothing else touches
 * the accounting tables — including the referral source, which lives in its own
 * profile row rather than as a column on CONTACTS.
 */

exports.up = async (knex) => {
  // Extra customer detail that is ours, not upstream's.
  await knex.schema.createTable('rpw_contact_profiles', (table) => {
    table.increments('id').primary();
    table.integer('contact_id').unsigned().notNullable().unique();
    // Referrals drive this business, so who sent them is worth a field.
    table.string('referral_source', 255).nullable();
    table.timestamps(false, true);
  });

  // Free-text notes, newest-first on the timeline.
  await knex.schema.createTable('rpw_contact_notes', (table) => {
    table.increments('id').primary();
    table.integer('contact_id').unsigned().notNullable();
    table.text('body').notNullable();
    table.timestamps(false, true);

    table.index(['contact_id', 'created_at']);
  });

  // Auto-logged history: estimate sent, invoice sent, payment received.
  // Written by event subscribers so the accounting modules stay untouched.
  await knex.schema.createTable('rpw_contact_events', (table) => {
    table.increments('id').primary();
    table.integer('contact_id').unsigned().notNullable();
    table.string('event_type', 64).notNullable();
    table.string('reference_type', 32).nullable();
    table.integer('reference_id').unsigned().nullable();
    table.string('summary', 255).notNullable();
    table.datetime('occurred_at').notNullable();
    table.timestamps(false, true);

    table.index(['contact_id', 'occurred_at']);
    // An event may be emitted more than once (a retried job, a re-send); this
    // keeps the timeline from growing duplicates. Named explicitly because the
    // generated name for four columns runs past MySQL's 64-character limit.
    table.unique(
      ['contact_id', 'event_type', 'reference_type', 'reference_id'],
      { indexName: 'rpw_contact_events_dedupe_unique' },
    );
  });

  // Follow-ups: a date, a note, and whether it has been dealt with.
  await knex.schema.createTable('rpw_follow_ups', (table) => {
    table.increments('id').primary();
    table.integer('contact_id').unsigned().nullable();
    table.string('reference_type', 32).nullable();
    table.integer('reference_id').unsigned().nullable();
    table.date('due_on').notNullable();
    table.string('note', 500).notNullable();
    table.datetime('done_at').nullable();
    table.timestamps(false, true);

    table.index(['due_on', 'done_at']);
    table.index(['contact_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('rpw_follow_ups');
  await knex.schema.dropTableIfExists('rpw_contact_events');
  await knex.schema.dropTableIfExists('rpw_contact_notes');
  await knex.schema.dropTableIfExists('rpw_contact_profiles');
};
