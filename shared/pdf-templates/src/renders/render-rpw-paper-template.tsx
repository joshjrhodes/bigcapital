import {
  RpwPaperTemplate,
  RpwPaperTemplateProps,
} from '../components/RpwPaperTemplate';
import { renderSSR } from './render-ssr';

/**
 * Renders the RPW-branded estimate/invoice to HTML, which Gotenberg then turns
 * into a PDF.
 */
export const renderRpwPaperTemplateHtml = (props: RpwPaperTemplateProps) => {
  return renderSSR(<RpwPaperTemplate {...props} />);
};

export const renderRpwInvoicePaperTemplateHtml = (
  props: RpwPaperTemplateProps,
) => renderRpwPaperTemplateHtml({ ...props, documentKind: 'invoice' });

export const renderRpwEstimatePaperTemplateHtml = (
  props: RpwPaperTemplateProps,
) => renderRpwPaperTemplateHtml({ ...props, documentKind: 'estimate' });
