import { enqueue } from '@/lib/offlineQueue';

/**
 * Drop-in replacement for fetch() for mutation calls (POST/PUT/PATCH/DELETE).
 * - If online: behaves exactly like fetch().
 * - If offline (NetworkError): saves the request to IndexedDB and returns a
 *   synthetic 202 response so the UI can proceed optimistically.
 *
 * GET requests pass through unchanged.
 */
export async function queuedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();

  try {
    const res = await fetch(input, init);
    return res;
  } catch (err) {
    // Only queue if it looks like a genuine network failure (not an API error)
    const isNetworkError = err instanceof TypeError && err.message.toLowerCase().includes('fetch');
    if (!isNetworkError || method === 'GET') throw err;

    // Queue the request for later replay
    const url     = input instanceof Request ? input.url : String(input);
    const headers: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((v, k) => { headers[k] = v; });
    }
    const body = init?.body ? String(init.body) : null;

    await enqueue({
      id:        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url,
      method,
      headers,
      body,
      timestamp: Date.now(),
    });

    // Return a synthetic "queued" response so optimistic UI updates work
    return new Response(JSON.stringify({ queued: true, offline: true }), {
      status:  202,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
