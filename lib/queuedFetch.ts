import { enqueue } from '@/lib/offlineQueue';

/**
 * Drop-in replacement for fetch() for mutation calls (POST/PUT/PATCH/DELETE).
 * - If online: behaves exactly like fetch().
 * - If offline (NetworkError): saves the request to IndexedDB and returns a
 *   synthetic 202 response so the UI can proceed optimistically.
 *
 * GET requests pass through unchanged.
 */
async function enqueueAndRespond(input: RequestInfo | URL, method: string, init?: RequestInit): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  const headers: Record<string, string> = {};
  if (init?.headers) {
    new Headers(init.headers as HeadersInit).forEach((v, k) => { headers[k] = v; });
  }
  const body = init?.body ? String(init.body) : null;
  await enqueue({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, url, method, headers, body, timestamp: Date.now() });
  return new Response(JSON.stringify({ queued: true, offline: true }), {
    status: 202, headers: { 'Content-Type': 'application/json' },
  });
}

export async function queuedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();

  // Proactively queue when browser already knows we're offline (avoids a failed round-trip)
  if (typeof navigator !== 'undefined' && !navigator.onLine && method !== 'GET') {
    return enqueueAndRespond(input, method, init);
  }

  try {
    const res = await fetch(input, init);
    return res;
  } catch (err) {
    // Queue on any TypeError — covers Chrome "Failed to fetch", Firefox "NetworkError…",
    // and Safari "The Internet connection appears to be offline"
    const isNetworkError = err instanceof TypeError;
    if (!isNetworkError || method === 'GET') throw err;

    return enqueueAndRespond(input, method, init);
  }
}
