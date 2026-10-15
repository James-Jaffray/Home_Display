/**
 * Small wrapper around fetch for the dashboard's API. Throws an Error with `.status`
 * and (for validation failures) `.problems` so the UI can show what was wrong.
 *
 * @param {string} path
 * @param {{method?: string, body?: unknown, blob?: Blob}} [options]
 */
export async function api(path, { method = 'GET', body, blob } = {}) {
  const headers = {};
  let payload;
  if (blob) {
    headers['Content-Type'] = blob.type;
    payload = blob;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(path, { method, headers, body: payload, credentials: 'same-origin' });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error ?? `Request failed (${res.status})`);
    err.status = res.status;
    err.problems = data?.problems ?? [];
    throw err;
  }
  return data;
}
