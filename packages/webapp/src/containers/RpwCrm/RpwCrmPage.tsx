// @ts-nocheck
import React from 'react';
import {
  Button,
  Callout,
  Classes,
  HTMLSelect,
  InputGroup,
  Intent,
  Spinner,
  Tag,
  TextArea,
} from '@blueprintjs/core';
import { DashboardPageContent } from '@/components';
import {
  useAddRpwNote,
  useCompleteRpwFollowUp,
  useCreateRpwFollowUp,
  useRpwCrmCustomers,
  useRpwCrmTimeline,
  useRpwFollowUps,
  useSetRpwReferralSource,
  useSnoozeRpwFollowUp,
} from '@/hooks/query/rpw-crm';

/**
 * Clients (RPW): what has happened with someone, and what to do next.
 *
 * Deliberately one page rather than a tab buried in the customer drawer —
 * follow-ups are only useful if they are the first thing you see.
 */
const iso = (date) => date.toISOString().slice(0, 10);
const addDays = (days, from = new Date()) =>
  iso(new Date(from.getTime() + days * 86400000));

function FollowUpRow({ item, onDone, onSnooze }) {
  const overdue = item.is_overdue ?? item.isOverdue;
  const name = item.contact_name ?? item.contactName;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 0',
        borderBottom: '1px solid #e6e3df',
      }}
    >
      <Tag minimal intent={overdue ? Intent.DANGER : Intent.NONE}>
        {item.due_on ?? item.dueOn}
      </Tag>
      <div style={{ flex: 1 }}>
        <div>{item.note}</div>
        {name && <div className={Classes.TEXT_MUTED}>{name}</div>}
      </div>
      <Button small minimal onClick={() => onSnooze(item.id, addDays(7))}>
        Snooze a week
      </Button>
      <Button small intent={Intent.SUCCESS} onClick={() => onDone(item.id)}>
        Done
      </Button>
    </div>
  );
}

export function RpwCrmPage() {
  const today = iso(new Date());
  const [contactId, setContactId] = React.useState(null);
  const [note, setNote] = React.useState('');
  const [referral, setReferral] = React.useState('');
  const [followUpNote, setFollowUpNote] = React.useState('');
  const [followUpDate, setFollowUpDate] = React.useState(addDays(5));
  const [error, setError] = React.useState(null);

  const { data: customers = [], isLoading } = useRpwCrmCustomers();
  const { data: board } = useRpwFollowUps(today);
  const { data: timeline = [] } = useRpwCrmTimeline(contactId);

  const { mutateAsync: addNote } = useAddRpwNote();
  const { mutateAsync: setReferralSource } = useSetRpwReferralSource();
  const { mutateAsync: createFollowUp } = useCreateRpwFollowUp();
  const { mutateAsync: completeFollowUp } = useCompleteRpwFollowUp();
  const { mutateAsync: snoozeFollowUp } = useSnoozeRpwFollowUp();

  const customer = customers.find((c) => c.id === contactId) || null;

  React.useEffect(() => {
    if (!contactId && customers.length) setContactId(customers[0].id);
  }, [customers, contactId]);

  React.useEffect(() => {
    setReferral(customer?.referralSource || '');
  }, [customer?.id, customer?.referralSource]);

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
  const due = board?.due || [];
  const upcoming = board?.upcoming || [];

  return (
    <DashboardPageContent>
      <div style={{ padding: 24, maxWidth: 1000 }}>
        <h2 style={{ marginTop: 0 }}>Clients</h2>

        {error && (
          <Callout intent={Intent.DANGER} style={{ marginBottom: 16 }}>
            {error}
          </Callout>
        )}

        {/* What needs doing comes first. */}
        <h3>Needs attention</h3>
        {due.length === 0 ? (
          <Callout intent={Intent.SUCCESS} style={{ marginBottom: 16 }}>
            Nothing due today. Anything overdue would still be here.
          </Callout>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {due.map((item) => (
              <FollowUpRow
                key={item.id}
                item={item}
                onDone={(id) => run(() => completeFollowUp(id))}
                onSnooze={(id, date) => run(() => snoozeFollowUp([id, date]))}
              />
            ))}
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <h3>Coming up</h3>
            <div style={{ marginBottom: 16 }}>
              {upcoming.map((item) => (
                <FollowUpRow
                  key={item.id}
                  item={item}
                  onDone={(id) => run(() => completeFollowUp(id))}
                  onSnooze={(id, date) => run(() => snoozeFollowUp([id, date]))}
                />
              ))}
            </div>
          </>
        )}
        <p className={Classes.TEXT_MUTED}>
          Whatever is due lands in your inbox at 7am as well, so it does not
          depend on you opening this page.
        </p>

        <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid #e6e3df' }} />

        {customers.length === 0 ? (
          <Callout intent={Intent.PRIMARY}>
            <p>No customers yet.</p>
            <Button
              intent={Intent.PRIMARY}
              onClick={() => (window.location.href = '/customers/new')}
            >
              Add your first customer
            </Button>
          </Callout>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>History</h3>
              <HTMLSelect
                value={contactId || ''}
                onChange={(event) => setContactId(Number(event.currentTarget.value))}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </HTMLSelect>
              <Button
                small
                minimal
                icon="plus"
                onClick={() => (window.location.href = '/customers/new')}
              >
                Add customer
              </Button>
            </div>

            <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 420px' }}>
                <TextArea
                  fill
                  growVertically
                  placeholder="What happened? Site visit, phone call, what they asked for…"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                />
                <Button
                  style={{ marginTop: 8 }}
                  intent={Intent.PRIMARY}
                  disabled={!note.trim()}
                  onClick={() =>
                    run(async () => {
                      await addNote([contactId, note.trim()]);
                      setNote('');
                    })
                  }
                >
                  Add note
                </Button>

                <div style={{ marginTop: 20 }}>
                  {timeline.length === 0 && (
                    <p className={Classes.TEXT_MUTED}>
                      Nothing recorded yet. Estimates, invoices and payments log
                      themselves here as they happen.
                    </p>
                  )}
                  {timeline.map((entry) => (
                    <div
                      key={`${entry.kind}-${entry.id}`}
                      style={{ padding: '8px 0', borderBottom: '1px solid #f0eeeb' }}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                        <Tag minimal intent={entry.kind === 'note' ? Intent.PRIMARY : Intent.NONE}>
                          {entry.kind === 'note' ? 'Note' : 'Activity'}
                        </Tag>
                        <span className={Classes.TEXT_MUTED} style={{ fontSize: 12 }}>
                          {new Date(entry.at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        {entry.kind === 'note' ? entry.body : entry.summary}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: '0 1 320px' }}>
                <label className={Classes.LABEL}>
                  Referred by
                  <InputGroup
                    placeholder="Who sent them?"
                    value={referral}
                    onChange={(event) => setReferral(event.target.value)}
                    onBlur={() =>
                      referral !== (customer?.referralSource || '') &&
                      run(() => setReferralSource([contactId, referral]))
                    }
                  />
                </label>

                <div style={{ marginTop: 20 }}>
                  <h4 style={{ marginBottom: 6 }}>Set a follow-up</h4>
                  <InputGroup
                    placeholder="Chase the Easter estimate"
                    value={followUpNote}
                    onChange={(event) => setFollowUpNote(event.target.value)}
                  />
                  <InputGroup
                    type="date"
                    style={{ marginTop: 8 }}
                    value={followUpDate}
                    onChange={(event) => setFollowUpDate(event.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {[
                      ['In 3 days', 3],
                      ['In 5 days', 5],
                      ['In 2 weeks', 14],
                    ].map(([label, days]) => (
                      <Button key={days} small minimal onClick={() => setFollowUpDate(addDays(days))}>
                        {label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    style={{ marginTop: 8 }}
                    intent={Intent.PRIMARY}
                    disabled={!followUpNote.trim()}
                    onClick={() =>
                      run(async () => {
                        await createFollowUp({
                          contactId,
                          dueOn: followUpDate,
                          note: followUpNote.trim(),
                        });
                        setFollowUpNote('');
                      })
                    }
                  >
                    Remind me
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardPageContent>
  );
}
