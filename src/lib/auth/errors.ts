/**
 * Помилки Supabase Auth → коди повідомлень (errors.*). Спершу за
 * error.code (стабільний), потім за текстом (старі версії GoTrue).
 */
export type AuthErrorCode =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "userExists"
  | "weakPassword"
  | "samePassword"
  | "rateLimited"
  | "sessionExpired"
  | "authFailed";

const BY_CODE: Record<string, AuthErrorCode> = {
  invalid_credentials: "invalidCredentials",
  email_not_confirmed: "emailNotConfirmed",
  user_already_exists: "userExists",
  email_exists: "userExists",
  weak_password: "weakPassword",
  same_password: "samePassword",
  over_email_send_rate_limit: "rateLimited",
  over_request_rate_limit: "rateLimited",
  over_sms_send_rate_limit: "rateLimited",
  session_not_found: "sessionExpired",
  session_expired: "sessionExpired",
  refresh_token_not_found: "sessionExpired",
};

const BY_MESSAGE: [RegExp, AuthErrorCode][] = [
  [/invalid login credentials/i, "invalidCredentials"],
  [/email not confirmed/i, "emailNotConfirmed"],
  [/already (been )?registered|already exists/i, "userExists"],
  [/password should (be|contain)/i, "weakPassword"],
  [/different from the old password/i, "samePassword"],
  [/rate limit|too many requests/i, "rateLimited"],
  [/session/i, "sessionExpired"],
];

export function authErrorCode(error: { code?: string | null; message?: string | null }): AuthErrorCode {
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  const message = error.message ?? "";
  return BY_MESSAGE.find(([re]) => re.test(message))?.[1] ?? "authFailed";
}
