/** Fetches a JSON document without credentials; `what` ("manifest", "log") names it in the error messages. */
export async function fetchJson(url: string | URL, what: string): Promise<unknown> {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`The ${what} could not be fetched (HTTP ${res.status}).`);
  try {
    return await res.json();
  } catch {
    throw new Error(`The ${what} is not valid JSON.`);
  }
}
