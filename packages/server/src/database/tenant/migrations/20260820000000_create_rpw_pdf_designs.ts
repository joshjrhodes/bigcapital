/**
 * RPW — visual PDF designs (Phase 3).
 *
 * Phase 1's estimate/invoice layout is a React component: changing it means
 * changing code. This adds designs Josh can edit himself in a drag-and-drop
 * designer, stored as pdfme template JSON.
 *
 * Two tables rather than one because a layout people edit by hand needs an
 * undo that survives a bad afternoon: every save writes a new version row and
 * moves the design's pointer, so rolling back is repointing, not recovering.
 *
 * Nothing here replaces the Phase 1 template — it stays the fallback whenever a
 * design is missing, inactive, or fails to render.
 */

exports.up = async (knex) => {
  await knex.schema.createTable('rpw_pdf_designs', (table) => {
    table.increments('id').primary();
    // 'SaleInvoice' | 'SaleEstimate'
    table.string('resource', 32).notNullable();
    table.string('name', 128).notNullable();
    // Only one design per resource is used for generation.
    table.boolean('is_active').notNullable().defaultTo(false);
    table.integer('active_version_id').unsigned().nullable();
    table.timestamps(false, true);

    table.index(['resource', 'is_active']);
  });

  await knex.schema.createTable('rpw_pdf_design_versions', (table) => {
    table.increments('id').primary();
    table.integer('design_id').unsigned().notNullable();
    // Monotonic per design, so "version 4" means something to a human.
    table.integer('version').notNullable();
    // pdfme Template JSON: { basePdf, schemas }.
    table.text('template_json', 'longtext').notNullable();
    table.string('note', 255).nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['design_id', 'version']);
    table.index(['design_id']);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('rpw_pdf_design_versions');
  await knex.schema.dropTableIfExists('rpw_pdf_designs');
};
