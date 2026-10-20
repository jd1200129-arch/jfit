type ApiResponse = { ok: boolean; status: number; json(): Promise<unknown> };
export type Requester = (
  input: string,
  init?: RequestInit,
) => Promise<ApiResponse>;

async function resultOf(
  response: ApiResponse,
): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export async function revokeNativeSession(
  request: Requester,
  apiBase: string,
  token: string,
): Promise<boolean> {
  const response = await request(`${apiBase}/v1/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) return true;
  const result = await resultOf(response);
  return response.ok && result.loggedOut === true;
}

export async function revokeAllNativeSessions(
  request: Requester,
  apiBase: string,
  token: string,
): Promise<boolean> {
  const response = await request(`${apiBase}/v1/auth/logout-all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await resultOf(response);
  return response.ok && result.sessionsRevoked === true;
}

export async function revokeOtherNativeSession(
  request: Requester,
  apiBase: string,
  token: string,
  sessionId: string,
): Promise<boolean> {
  const response = await request(`${apiBase}/v1/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await resultOf(response);
  return response.ok && result.revoked === true;
}
