import { loadVideoSitemapGroup, renderVideoUrlset, videoSitemapHeaders } from '../_lib/video-sitemap.js';

function notFound() {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-robots-tag': 'noindex, follow',
    },
  });
}

export async function onRequestGet(context) {
  const group = String(context.params?.bucket || '').trim();
  if (!/^(?:recent|[0-9]{4}(?:_[0-9]{2})?)$/.test(group)) return notFound();

  const entries = await loadVideoSitemapGroup(context, group);
  if (!entries) return notFound();

  return new Response(renderVideoUrlset(entries), {
    status: 200,
    headers: videoSitemapHeaders(),
  });
}

export async function onRequestHead(context) {
  const response = await onRequestGet(context);
  return new Response(null, { status: response.status, headers: response.headers });
}

export function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'HEAD') return onRequestHead(context);
  return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
}
