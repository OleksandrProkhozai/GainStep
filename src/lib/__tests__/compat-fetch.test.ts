import { afterEach, describe, expect, it, vi } from "vitest";

import { compatFetch } from "../supabase/compat-fetch";

const BASE = "https://x.supabase.co/rest/v1";
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("compatFetch — база без міграції i18n", () => {
  it("повторює select без name_uk, якщо колонки немає", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        calls.push(decodeURIComponent(url));
        return url.includes("name_uk")
          ? json(400, { code: "42703", message: "column exercises_4.name_uk does not exist" })
          : json(200, [{ id: 1 }]);
      }),
    );
    const res = await compatFetch(`${BASE}/programs?select=id,name,name_uk,program_days(id,name,name_uk,exercises(name,name_uk))`);
    expect(res.status).toBe(200);
    expect(calls.at(-1)).toContain("select=id,name,program_days(id,name,exercises(name))");
  });

  it("оновлення лише мови без колонки locale — успіх без запиту", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(400, { code: "PGRST204", message: "Could not find the 'locale' column of 'profiles'" })));
    const res = await compatFetch(`${BASE}/profiles?id=eq.1`, { method: "PATCH", body: JSON.stringify({ locale: "uk" }) });
    expect(res.status).toBe(204);
  });

  it("clone_program без p_locale на старій сигнатурі", async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_: string, init?: RequestInit) => {
        bodies.push(String(init?.body));
        return String(init?.body).includes("p_locale") ? json(404, { code: "PGRST202", message: "not found" }) : json(200, "new-id");
      }),
    );
    const res = await compatFetch(`${BASE}/rpc/clone_program`, {
      method: "POST",
      body: JSON.stringify({ template_id: "t", p_locale: "uk" }),
    });
    expect(res.status).toBe(200);
    expect(bodies.at(-1)).toBe(JSON.stringify({ template_id: "t" }));
  });
});
