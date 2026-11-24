const SUPABASE_REQUEST_TIMEOUT_MS = 12_000;

export function supabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const timeout = AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}
