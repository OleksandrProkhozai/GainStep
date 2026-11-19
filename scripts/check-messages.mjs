#!/usr/bin/env node
/**
 * Перевірка перекладів: ключі messages/en.json і messages/uk.json мають
 * збігатися (обидва напрямки), значення — непорожні рядки.
 * Запуск: npm run i18n:check. Код виходу 1, якщо щось не так.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = ["en", "uk"];

/** Плоский список "a.b.c" → значення. */
export function flatten(obj, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, full, out);
    else out.set(full, value);
  }
  return out;
}

/** Порівняння двох наборів повідомлень: відсутні ключі й порожні значення. */
export function compareMessages(base, other) {
  const a = flatten(base);
  const b = flatten(other);
  return {
    missing: [...a.keys()].filter((k) => !b.has(k)),
    extra: [...b.keys()].filter((k) => !a.has(k)),
    empty: [...b].filter(([, v]) => typeof v !== "string" || v.trim() === "").map(([k]) => k),
  };
}

function main() {
  const messages = Object.fromEntries(
    LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(root, "messages", `${l}.json`), "utf8"))]),
  );
  const [base, ...others] = LOCALES;
  let failed = false;
  for (const locale of others) {
    const { missing, extra, empty } = compareMessages(messages[base], messages[locale]);
    const emptyBase = compareMessages(messages[locale], messages[base]).empty;
    for (const [label, keys] of [
      [`missing in ${locale}.json`, missing],
      [`missing in ${base}.json`, extra],
      [`empty in ${locale}.json`, empty],
      [`empty in ${base}.json`, emptyBase],
    ]) {
      if (keys.length === 0) continue;
      failed = true;
      console.error(`✗ ${keys.length} key(s) ${label}:`);
      for (const k of keys) console.error(`    ${k}`);
    }
  }
  const total = flatten(messages[base]).size;
  if (failed) process.exit(1);
  console.log(`✓ messages: ${total} keys, ${LOCALES.join(" / ")} match`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
