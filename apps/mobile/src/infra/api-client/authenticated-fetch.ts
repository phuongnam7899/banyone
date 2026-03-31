export async function banyoneAuthenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  getIdToken: () => Promise<string | null>,
): Promise<Response> {
  const token = await getIdToken();
  if (!token) {
    throw new Error("Banyone: missing Firebase ID token for authenticated request");
  }

  const nextHeaders = new Headers(init?.headers ?? undefined);
  nextHeaders.set("Authorization", `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers: nextHeaders,
  });
}
