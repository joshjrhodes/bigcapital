/**
 * RPW — customer tax exemption (churches, schools, nonprofits).
 *
 * Ohio expects a vendor to hold an exemption certificate (STEC) on file for
 * every exempt customer, so this is three fields, not one: the flag, the
 * stated reason, and the certificate itself in object storage.
 *
 * Collection is still off globally; when it is switched on, document-level
 * tax application must check this flag first. Lives on our own profile table —
 * upstream's CONTACTS stays untouched.
 */

exports.up = async (knex) => {
  await knex.schema.alterTable('rpw_contact_profiles', (table) => {
    table.boolean('is_tax_exempt').notNullable().defaultTo(false);
    table.string('tax_exemption_reason', 255).nullable();
    table.string('tax_exemption_certificate_key', 255).nullable();
  });
};

exports.down = async (knex) => {
  await knex.schema.alterTable('rpw_contact_profiles', (table) => {
    table.dropColumn('is_tax_exempt');
    table.dropColumn('tax_exemption_reason');
    table.dropColumn('tax_exemption_certificate_key');
  });
};
