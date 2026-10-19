import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "jfit.session.v1";
const PENDING_REVOCATIONS_KEY = "jfit.session-revocations.v1";
export async function storeSession(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
export async function readSession(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function queueSessionRevocation(token: string): Promise<void> {
  const pending = await readPendingSessionRevocations();
  if (pending.includes(token)) return;
  if (pending.length >= 25)
    throw new Error(
      "Too many offline sign-out attempts are pending. Reconnect to finish signing out.",
    );
  await SecureStore.setItemAsync(
    PENDING_REVOCATIONS_KEY,
    JSON.stringify([...pending, token]),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
  );
}

export async function readPendingSessionRevocations(): Promise<string[]> {
  const value = await SecureStore.getItemAsync(PENDING_REVOCATIONS_KEY);
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(
          (token): token is string =>
            typeof token === "string" &&
            token.length >= 32 &&
            token.length <= 2048,
        )
      : [];
  } catch {
    return [];
  }
}

export async function removePendingSessionRevocation(
  token: string,
): Promise<void> {
  const pending = await readPendingSessionRevocations();
  const remaining = pending.filter((item) => item !== token);
  if (remaining.length)
    await SecureStore.setItemAsync(
      PENDING_REVOCATIONS_KEY,
      JSON.stringify(remaining),
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  else await SecureStore.deleteItemAsync(PENDING_REVOCATIONS_KEY);
}
