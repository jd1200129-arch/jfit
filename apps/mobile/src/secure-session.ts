import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'jfit.session.v1';
export async function storeSession(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
export async function readSession(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}
export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
