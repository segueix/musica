const PAIRING_TTL_SECONDS = 600;
const DEVICE_TTL_SECONDS = 60 * 60 * 24 * 30;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function generateFourDigitCode() {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

async function generateUniqueCode(kv, attempts = 6) {
  for (let i = 0; i < attempts; i += 1) {
    const code = generateFourDigitCode();
    const existing = await kv.get(code);
    if (!existing) return code;
  }

  // fallback si hi ha col·lisions repetides
  const fallback = String(Date.now()).slice(-4);
  return fallback.padStart(4, '0');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env?.SEGUEIX_SYNC) {
    return jsonResponse({ error: 'KV no configurat' }, 500);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Cos JSON no vàlid' }, 400);
  }

  if (!payload || typeof payload !== 'object') {
    return jsonResponse({ error: 'Petició no vàlida' }, 400);
  }

  if (payload.isInitialPairing === true) {
    const uuid = typeof payload.uuid === 'string' ? payload.uuid.trim() : '';
    if (!uuid) {
      return jsonResponse({ error: 'Cal enviar uuid per iniciar la vinculació' }, 400);
    }

    const code = await generateUniqueCode(env.SEGUEIX_SYNC);
    const serialized = JSON.stringify(payload);

    // KV és eventualment consistent entre punts de presència. Guardem també la
    // configuració sota l'UUID des del primer moment perquè la vinculació deixi un
    // registre persistent encara que el codi temporal es consumeixi de seguida.
    await Promise.all([
      env.SEGUEIX_SYNC.put(code, serialized, {
        expirationTtl: PAIRING_TTL_SECONDS,
      }),
      env.SEGUEIX_SYNC.put(uuid, serialized, {
        expirationTtl: DEVICE_TTL_SECONDS,
      }),
    ]);

    return jsonResponse({
      ok: true,
      code,
      expiresInSeconds: PAIRING_TTL_SECONDS,
    });
  }

  const uuid = typeof payload.uuid === 'string' ? payload.uuid.trim() : '';
  if (!uuid) {
    return jsonResponse({ error: 'Cal enviar uuid o isInitialPairing' }, 400);
  }

  await env.SEGUEIX_SYNC.put(uuid, JSON.stringify(payload), {
    expirationTtl: DEVICE_TTL_SECONDS,
  });

  return jsonResponse({
    ok: true,
    uuid,
    expiresInSeconds: DEVICE_TTL_SECONDS,
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env?.SEGUEIX_SYNC) {
    return jsonResponse({ error: 'KV no configurat' }, 500);
  }

  const url = new URL(request.url);
  const code = (url.searchParams.get('code') || '').trim();
  const uuid = (url.searchParams.get('uuid') || '').trim();

  if (!code && !uuid) {
    return jsonResponse({ error: 'Cal code o uuid' }, 400);
  }

  const key = code || uuid;
  const raw = await env.SEGUEIX_SYNC.get(key);

  if (!raw) {
    if (code) {
      return jsonResponse({
        error: 'Codi encara no disponible o caducat',
        reason: 'PAIRING_CODE_NOT_FOUND',
      }, 404);
    }

    return jsonResponse({
      error: 'No hi ha dades al núvol per aquest dispositiu',
      reason: 'DEVICE_NOT_FOUND',
    }, 404);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: 'Dades corruptes al servidor' }, 500);
  }

  if (code) {
    await env.SEGUEIX_SYNC.delete(code);
  }

  return jsonResponse({ ok: true, data });
}
