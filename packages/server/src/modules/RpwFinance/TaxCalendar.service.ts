import { Injectable } from '@nestjs/common';

export interface TaxDeadline {
  label: string;
  date: string;
  daysAway: number;
  links: { label: string; url: string }[];
}

/**
 * Upcoming federal/Ohio estimated-payment dates — a reminder surface, not a
 * payment integration, exactly as the brief specifies.
 *
 * Quarterly estimates fall on Apr 15, Jun 15, Sep 15 and Jan 15, rolled
 * forward over weekends. Holiday shifts (Emancipation Day and the like) are
 * NOT modelled — the widget says so, and being a day early costs nothing.
 */
const PAYMENT_LINKS = [
  { label: 'IRS Direct Pay', url: 'https://www.irs.gov/payments/direct-pay' },
  {
    label: 'Ohio online payment',
    url: 'https://tax.ohio.gov/individual/pay-online',
  },
];

@Injectable()
export class TaxCalendarService {
  public upcoming(asOf?: string, count = 4): TaxDeadline[] {
    const today = asOf ? new Date(`${asOf}T00:00:00`) : new Date();
    const deadlines: TaxDeadline[] = [];

    for (let year = today.getFullYear() - 1; deadlines.length < count; year++) {
      const quarters: [string, Date][] = [
        [`Q1 ${year} estimated payment`, new Date(year, 3, 15)],
        [`Q2 ${year} estimated payment`, new Date(year, 5, 15)],
        [`Q3 ${year} estimated payment`, new Date(year, 8, 15)],
        [`Q4 ${year} estimated payment`, new Date(year + 1, 0, 15)],
      ];
      for (const [label, rawDate] of quarters) {
        const date = rollForwardWeekend(rawDate);
        if (date < today) continue;
        if (deadlines.length >= count) break;

        deadlines.push({
          label,
          date: date.toISOString().slice(0, 10),
          daysAway: Math.ceil((date.getTime() - today.getTime()) / 86400000),
          links: PAYMENT_LINKS,
        });
      }
    }
    return deadlines;
  }
}

function rollForwardWeekend(date: Date): Date {
  const rolled = new Date(date);
  while (rolled.getDay() === 0 || rolled.getDay() === 6) {
    rolled.setDate(rolled.getDate() + 1);
  }
  return rolled;
}
