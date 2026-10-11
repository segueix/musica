// Compatibilitat amb enllaços antics: la categoria conjunta ja no existeix.
export function onRequest(context) {
  return Response.redirect(new URL('/punk', context.request.url), 301);
}
