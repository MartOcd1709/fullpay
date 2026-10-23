// Client fetch for our JSON routes: returns data or throws Error(message) from the { error: { code, message } } contract.
export async function api(path, { method = "POST", body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error("network"), { code: "network" });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error?.message ?? `HTTP ${res.status}`), { code: data?.error?.code ?? "http", status: res.status });
  return data;
}
