export type LoginTransport = "cookie" | "bearer" | "reject";

type AppOrigins = string | ReadonlySet<string>;

function isAllowedOrigin(origin: string, appOrigins: AppOrigins): boolean {
  return typeof appOrigins === "string"
    ? appOrigins !== "" && origin === appOrigins
    : appOrigins.has(origin);
}

export function allowsPublicAuthRequest(
  origin: string | undefined,
  appOrigins: AppOrigins,
): boolean {
  if (origin === undefined) return true;
  return isAllowedOrigin(origin, appOrigins);
}

export function allowsCookieMutation(
  origin: string | undefined,
  appOrigins: AppOrigins,
): boolean {
  return origin !== undefined && isAllowedOrigin(origin, appOrigins);
}

export function loginTransport(
  origin: string | undefined,
  appOrigins: AppOrigins,
): LoginTransport {
  if (origin === undefined) return "bearer";
  return isAllowedOrigin(origin, appOrigins) ? "cookie" : "reject";
}
