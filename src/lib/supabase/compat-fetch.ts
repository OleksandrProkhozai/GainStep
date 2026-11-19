/**
 * Сумісність із базою, де ще не застосовано міграцію i18n
 * (20261118000003_i18n.sql): немає exercises/programs/program_days.name_uk,
 * profiles.locale і параметра clone_program(p_locale).
 *
 * Обгортка над fetch для клієнтів Supabase: якщо PostgREST відповідає, що
 * такої колонки / параметра немає, запит повторюється без них. Застосунок
 * працює (назви — англійською, мова — з cookie), а після міграції все
 * вмикається само: перевірка повторюється раз на хвилину.
 */

const RECHECK_MS = 60_000;
let nameUkMissingSince: number | null = null;

const nameUkKnownMissing = () => nameUkMissingSince !== null && Date.now() - nameUkMissingSince < RECHECK_MS;

/** select=id,name,name_uk,exercises(name,name_uk) → без name_uk. */
function stripNameUk(url: URL) {
  const next = new URL(url);
  const select = next.searchParams.get("select");
  if (select) {
    next.searchParams.set(
      "select",
      select
        .replace(/,name_uk(?=[,)]|$)/g, "")
        .replace(/\(name_uk,/g, "(")
        .replace(/^name_uk,/, ""),
    );
  }
  return next;
}

async function errorBody(res: Response): Promise<{ code?: string; message?: string } | null> {
  return res
    .clone()
    .json()
    .catch(() => null);
}

/** JSON-тіло без ключа; null — якщо тіло не JSON-об'єкт. */
function withoutKey(body: BodyInit | null | undefined, key: string): string | null {
  if (typeof body !== "string") return null;
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !(key in parsed)) return null;
    delete parsed[key];
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

export const compatFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (!url.pathname.includes("/rest/v1/")) return fetch(input, init);

  const select = url.searchParams.get("select") ?? "";
  const wantsNameUk = /(^|[,(])name_uk([,)]|$)/.test(select);

  // Уже знаємо, що колонки немає, — одразу без неї (без зайвого 400).
  if (wantsNameUk && nameUkKnownMissing()) return fetch(stripNameUk(url), init);

  const res = await fetch(input, init);
  if (res.ok) {
    if (wantsNameUk) nameUkMissingSince = null;
    return res;
  }

  const body = await errorBody(res);
  const message = body?.message ?? "";

  // 42703: column … name_uk does not exist
  if (wantsNameUk && body?.code === "42703" && message.includes("name_uk")) {
    nameUkMissingSince = Date.now();
    return fetch(stripNameUk(url), init);
  }

  // PGRST204: Could not find the 'locale' column of 'profiles'
  if (body?.code === "PGRST204" && message.includes("'locale'")) {
    const rest = withoutKey(init?.body, "locale");
    if (rest !== null) {
      // Лишалась тільки мова — нічого писати; мову тримає cookie NEXT_LOCALE.
      if (rest === "{}") return new Response(null, { status: 204 });
      return fetch(input, { ...init, body: rest });
    }
  }

  // PGRST202: clone_program(template_id, p_locale) ще не існує — стара сигнатура.
  if (body?.code === "PGRST202" && url.pathname.endsWith("/rpc/clone_program")) {
    const rest = withoutKey(init?.body, "p_locale");
    if (rest !== null) return fetch(input, { ...init, body: rest });
  }

  return res;
};
