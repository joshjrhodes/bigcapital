import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LogContactEventService } from '../commands/LogContactEvent.service';
import { events } from '@/common/events/events';
import { SaleInvoice } from '@/modules/SaleInvoices/models/SaleInvoice';
import { SaleEstimate } from '@/modules/SaleEstimates/models/SaleEstimate';
import { PaymentReceived } from '@/modules/PaymentReceived/models/PaymentReceived';
import { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

/**
 * Builds each customer's timeline by listening to what the accounting modules
 * already announce.
 *
 * This is the whole reason the CRM needs no changes to those modules: the
 * events exist, so the history is a subscriber away.
 */
@Injectable()
export class CrmActivitySubscriber {
  constructor(
    private readonly logEvent: LogContactEventService,
    @Inject(SaleInvoice.name)
    private readonly invoiceModel: TenantModelProxy<typeof SaleInvoice>,
    @Inject(SaleEstimate.name)
    private readonly estimateModel: TenantModelProxy<typeof SaleEstimate>,
    @Inject(PaymentReceived.name)
    private readonly paymentModel: TenantModelProxy<typeof PaymentReceived>,
  ) {}

  @OnEvent(events.saleEstimate.onMailSent)
  async onEstimateMailed({ saleEstimateId }: { saleEstimateId?: number }) {
    if (!saleEstimateId) return;
    const estimate = await this.estimateModel().query().findById(saleEstimateId);
    if (!estimate) return;

    await this.logEvent.log({
      contactId: estimate.customerId,
      eventType: 'estimate.sent',
      referenceType: 'SaleEstimate',
      referenceId: estimate.id,
      summary: `Estimate ${estimate.estimateNumber ?? ''} emailed`.trim(),
    });
  }

  @OnEvent(events.saleEstimate.onCreated)
  async onEstimateCreated({ saleEstimate }: any) {
    if (!saleEstimate?.customerId) return;

    await this.logEvent.log({
      contactId: saleEstimate.customerId,
      eventType: 'estimate.created',
      referenceType: 'SaleEstimate',
      referenceId: saleEstimate.id,
      summary: `Estimate ${saleEstimate.estimateNumber ?? ''} created`.trim(),
    });
  }

  @OnEvent(events.saleInvoice.onMailSent)
  async onInvoiceMailed({ saleInvoiceId }: { saleInvoiceId?: number }) {
    if (!saleInvoiceId) return;
    const invoice = await this.invoiceModel().query().findById(saleInvoiceId);
    if (!invoice) return;

    await this.logEvent.log({
      contactId: invoice.customerId,
      eventType: 'invoice.sent',
      referenceType: 'SaleInvoice',
      referenceId: invoice.id,
      summary: `Invoice ${invoice.invoiceNo ?? ''} emailed`.trim(),
    });
  }

  @OnEvent(events.saleInvoice.onCreated)
  async onInvoiceCreated({ saleInvoice }: any) {
    if (!saleInvoice?.customerId) return;

    await this.logEvent.log({
      contactId: saleInvoice.customerId,
      eventType: 'invoice.created',
      referenceType: 'SaleInvoice',
      referenceId: saleInvoice.id,
      summary: `Invoice ${saleInvoice.invoiceNo ?? ''} created`.trim(),
    });
  }

  @OnEvent(events.paymentReceive.onCreated)
  async onPaymentReceived(payload: any) {
    const paymentId = payload?.saleInvoiceId ?? payload?.paymentReceive?.id ?? payload?.paymentReceiveId;
    const payment =
      payload?.paymentReceive ??
      (paymentId ? await this.paymentModel().query().findById(paymentId) : null);

    if (!payment?.customerId) return;

    await this.logEvent.log({
      contactId: payment.customerId,
      eventType: 'payment.received',
      referenceType: 'PaymentReceived',
      referenceId: payment.id,
      summary: `Payment received${payment.amount ? ` — ${payment.amount}` : ''}`,
    });
  }
}
