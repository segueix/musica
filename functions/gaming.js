import { handleSeoSectionRequest } from './_lib/section-seo.js';

export function onRequest(context) {
  return handleSeoSectionRequest(context, 'gaming');
}
