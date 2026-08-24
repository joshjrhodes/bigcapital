// @ts-nocheck
import React from 'react';
import { Button } from '@blueprintjs/core';
import { useFormikContext } from 'formik';

/**
 * RPW: one click to mirror the billing address into the shipping fields.
 * For most of Josh's install jobs the two are the same building, and typing an
 * address twice is exactly the kind of friction that makes records go stale.
 *
 * Works on any form whose fields follow the billingAddress*/shippingAddress*
 * naming both the customer and vendor forms share.
 */
const ADDRESS_FIELDS = [
  'AddressCountry',
  'Address1',
  'Address2',
  'AddressCity',
  'AddressState',
  'AddressPostcode',
  'AddressPhone',
];

export function CopyBillingToShipping() {
  const { values, setFieldValue } = useFormikContext();

  const handleCopy = () => {
    ADDRESS_FIELDS.forEach((field) => {
      setFieldValue(`shipping${field}`, values[`billing${field}`] ?? '');
    });
  };

  return (
    <Button
      small
      minimal
      icon="duplicate"
      style={{ marginBottom: 10 }}
      onClick={handleCopy}
    >
      Copy from billing address
    </Button>
  );
}
