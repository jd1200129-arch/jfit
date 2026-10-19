type JsonResponse = { ok: boolean; json(): Promise<unknown> };
export type Requester = (
  input: string,
  init?: RequestInit,
) => Promise<JsonResponse>;

async function readResult(response: JsonResponse) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

export async function revokeDeviceSession(
  request: Requester,
  url: string,
): Promise<void> {
  const response = await request(url, {
    method: "DELETE",
    credentials: "include",
  });
  const result = await readResult(response);
  if (!response.ok || result.revoked !== true)
    throw new Error(
      typeof result.error === "object" &&
        result.error &&
        "message" in result.error
        ? String((result.error as { message: unknown }).message)
        : "The server did not confirm that session was revoked.",
    );
}

export async function revokeAllDeviceSessions(
  request: Requester,
  url: string,
): Promise<void> {
  const response = await request(url, {
    method: "POST",
    credentials: "include",
  });
  const result = await readResult(response);
  if (!response.ok || result.sessionsRevoked !== true)
    throw new Error(
      typeof result.error === "object" &&
        result.error &&
        "message" in result.error
        ? String((result.error as { message: unknown }).message)
        : "The server did not confirm sign-out on all devices.",
    );
}
