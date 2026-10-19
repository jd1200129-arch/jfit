export type LoginTransport = "cookie" | "bearer" | "reject";

export function allowsPublicAuthRequest(
  origin: string | undefined,
  appOrigin: string,
): boolean {
  if (origin === undefined) return true;
  return appOrigin !== "" && origin === appOrigin;
}

export function allowsCookieMutation(
  origin: string | undefined,
  appOrigin: string,
): boolean {
  return appOrigin !== "" && origin === appOrigin;
}

export function loginTransport(
  origin: string | undefined,
  appOrigin: string,
): LoginTransport {
  if (origin === undefined) return "bearer";
  return appOrigin !== "" && origin === appOrigin ? "cookie" : "reject";
}
