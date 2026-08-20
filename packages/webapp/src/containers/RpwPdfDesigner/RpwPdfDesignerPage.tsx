// @ts-nocheck
import React from 'react';
import {
  Button,
  Callout,
  Classes,
  Dialog,
  HTMLSelect,
  HTMLTable,
  Intent,
  Spinner,
  Tag,
} from '@blueprintjs/core';
import { DashboardPageContent } from '@/components';
import {
  useActivateRpwDesign,
  useEnsureRpwStockDesigns,
  useRestoreRpwDesignVersion,
  useRpwDesign,
  useRpwDesignPreview,
  useRpwDesignVersions,
  useRpwDesigns,
  useSaveRpwDesign,
} from '@/hooks/query/rpw-pdf-designer';

/**
 * Drag-and-drop designer for estimate and invoice layouts (Phase 3).
 *
 * pdfme is loaded on demand rather than bundled into the main chunk — it drags
 * in fontkit and pdf-lib, which is a lot of JavaScript for a page most sessions
 * never open.
 */
const RESOURCES = [
  { value: 'SaleInvoice', label: 'Invoice' },
  { value: 'SaleEstimate', label: 'Estimate' },
];

export function RpwPdfDesignerPage() {
  const [resource, setResource] = React.useState('SaleInvoice');
  const [designId, setDesignId] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [status, setStatus] = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [versionsOpen, setVersionsOpen] = React.useState(false);
  const [designerReady, setDesignerReady] = React.useState(false);

  const containerRef = React.useRef(null);
  const designerRef = React.useRef(null);

  const { data: designs = [], isLoading } = useRpwDesigns(resource);
  const { data: design } = useRpwDesign(designId);
  const { data: versions = [] } = useRpwDesignVersions(versionsOpen ? designId : undefined);

  const { mutateAsync: ensureStock } = useEnsureRpwStockDesigns();
  const { mutateAsync: saveDesign } = useSaveRpwDesign();
  const { mutateAsync: setActive } = useActivateRpwDesign();
  const { mutateAsync: restoreVersion } = useRestoreRpwDesignVersion();
  const renderPreview = useRpwDesignPreview();

  // Pick a design as soon as one exists for the chosen document type.
  React.useEffect(() => {
    if (!designs.length) {
      setDesignId(null);
      return;
    }
    if (!designs.some((d) => d.id === designId)) {
      setDesignId(designs[0].id);
    }
  }, [designs, designId]);

  // Mount the pdfme designer once the template is known.
  React.useEffect(() => {
    let cancelled = false;

    async function mount() {
      const templateJson = design?.active_version?.template_json;
      if (!containerRef.current || !templateJson) return;

      const [{ Designer }, schemas] = await Promise.all([
        import('@pdfme/ui'),
        import('@pdfme/schemas'),
      ]);
      if (cancelled) return;

      let template;
      try {
        template = JSON.parse(templateJson);
      } catch (err) {
        setError('This design could not be read. Roll back to an earlier version.');
        return;
      }
      designerRef.current?.destroy?.();
      designerRef.current = new Designer({
        domContainer: containerRef.current,
        template,
        plugins: {
          text: schemas.text,
          image: schemas.image,
          table: schemas.table,
          line: schemas.line,
          rectangle: schemas.rectangle,
          ellipse: schemas.ellipse,
        },
        options: { zoomLevel: 1, sidebarOpen: true },
      });
      setDesignerReady(true);
    }
    mount();

    return () => {
      cancelled = true;
      designerRef.current?.destroy?.();
      designerRef.current = null;
      setDesignerReady(false);
    };
  }, [design?.id, design?.active_version_id]);

  // Object URLs leak until revoked.
  React.useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const withFeedback = async (message, work) => {
    setError(null);
    setStatus(null);
    try {
      await work();
      setStatus(message);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Something went wrong.');
    }
  };

  const handleSave = () =>
    withFeedback('Saved as a new version.', async () => {
      const template = designerRef.current?.getTemplate();
      if (!template) throw new Error('The designer has not finished loading.');
      await saveDesign([designId, { template }]);
    });

  const handlePreview = () =>
    withFeedback(null, async () => {
      const template = designerRef.current?.getTemplate();
      const url = await renderPreview({ template, resource });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
    });

  const handleActivate = (active) =>
    withFeedback(
      active
        ? 'This layout is now used for new documents.'
        : 'Back to the built-in layout.',
      () => setActive([designId, active]),
    );

  const handleRestore = (versionId) =>
    withFeedback('Rolled back — reopen the designer to see it.', async () => {
      await restoreVersion([designId, versionId]);
      setVersionsOpen(false);
    });

  if (isLoading) {
    return (
      <DashboardPageContent>
        <Spinner size={30} />
      </DashboardPageContent>
    );
  }

  const isActive = Boolean(design?.is_active);

  return (
    <DashboardPageContent>
      <div style={{ padding: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, marginRight: 8 }}>Document designer</h2>

          <HTMLSelect
            value={resource}
            onChange={(event) => setResource(event.currentTarget.value)}
          >
            {RESOURCES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </HTMLSelect>

          {designs.length > 1 && (
            <HTMLSelect
              value={designId || ''}
              onChange={(event) => setDesignId(Number(event.currentTarget.value))}
            >
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </HTMLSelect>
          )}

          <div style={{ flex: 1 }} />

          <Button icon="document-open" onClick={handlePreview} disabled={!designerReady}>
            Preview
          </Button>
          <Button icon="history" onClick={() => setVersionsOpen(true)} disabled={!designId}>
            Versions
          </Button>
          <Button
            icon="floppy-disk"
            intent={Intent.PRIMARY}
            onClick={handleSave}
            disabled={!designerReady}
          >
            Save
          </Button>
          <Button
            icon={isActive ? 'cross' : 'tick'}
            intent={isActive ? Intent.NONE : Intent.SUCCESS}
            onClick={() => handleActivate(!isActive)}
            disabled={!designId}
          >
            {isActive ? 'Stop using' : 'Use for documents'}
          </Button>
        </div>

        {error && (
          <Callout intent={Intent.DANGER} style={{ marginBottom: 12 }}>
            {error}
          </Callout>
        )}
        {status && (
          <Callout intent={Intent.SUCCESS} style={{ marginBottom: 12 }}>
            {status}
          </Callout>
        )}

        {!designs.length ? (
          <Callout intent={Intent.PRIMARY}>
            <p>
              No design exists yet for this document type. Create one from the
              built-in layout and edit from there.
            </p>
            <Button
              intent={Intent.PRIMARY}
              onClick={() =>
                withFeedback('Design created from the built-in layout.', ensureStock)
              }
            >
              Create from built-in layout
            </Button>
          </Callout>
        ) : (
          <>
            <Callout
              intent={isActive ? Intent.SUCCESS : Intent.NONE}
              style={{ marginBottom: 12 }}
            >
              {isActive ? (
                <>
                  <strong>In use.</strong> New {resource === 'SaleEstimate' ? 'estimates' : 'invoices'}{' '}
                  render with this layout. If it ever fails to render, documents
                  fall back to the built-in design automatically — invoicing
                  cannot be broken by an edit here.
                </>
              ) : (
                <>
                  <strong>Not in use.</strong> Documents currently use the
                  built-in layout. Edit freely, preview, then choose “Use for
                  documents” when you are happy.
                </>
              )}
            </Callout>

            <div
              ref={containerRef}
              style={{
                height: '70vh',
                minHeight: 520,
                border: `1px solid ${'#d8d5d0'}`,
                borderRadius: 3,
                background: '#f6f5f3',
              }}
            />
            <p className={Classes.TEXT_MUTED} style={{ marginTop: 8 }}>
              Fields named <code>logo</code>, <code>bill_to</code>,{' '}
              <code>items</code>, <code>total</code> and the like are filled from
              the document when it is generated. Move them, resize them, change
              their type — the names are what connect them to the data, so
              renaming a field stops it being filled.
            </p>
          </>
        )}

        <Dialog
          isOpen={versionsOpen}
          onClose={() => setVersionsOpen(false)}
          title="Version history"
          style={{ width: 620 }}
        >
          <div className={Classes.DIALOG_BODY}>
            <HTMLTable striped style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Saved</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td>
                      {version.version}
                      {version.id === design?.active_version_id && (
                        <Tag minimal intent={Intent.SUCCESS} style={{ marginLeft: 6 }}>
                          current
                        </Tag>
                      )}
                    </td>
                    <td>{new Date(version.created_at).toLocaleString()}</td>
                    <td className={Classes.TEXT_MUTED}>{version.note || '—'}</td>
                    <td>
                      {version.id !== design?.active_version_id && (
                        <Button small minimal onClick={() => handleRestore(version.id)}>
                          Roll back to this
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          </div>
        </Dialog>

        <Dialog
          isOpen={Boolean(previewUrl)}
          onClose={() => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }}
          title="Preview"
          style={{ width: '80vw', height: '85vh' }}
        >
          <iframe
            title="Design preview"
            src={previewUrl || ''}
            style={{ width: '100%', height: '75vh', border: 0 }}
          />
        </Dialog>
      </div>
    </DashboardPageContent>
  );
}
