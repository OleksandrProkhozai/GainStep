import { z } from "zod";

/**
 * Глобальна мапа помилок zod → КОДИ (ключі простору errors у messages).
 * Не залежить від мови запиту, тож безпечна як глобальна конфігурація:
 * текст підставляє клієнт (useErrorText) мовою інтерфейсу.
 * Схеми з власним повідомленням теж пишуть код ("passwordMin" тощо).
 */
z.config({
  customError: (issue) => {
    switch (issue.code) {
      case "too_small":
        return "tooSmall";
      case "too_big":
        return "tooBig";
      case "invalid_format":
        return issue.format === "email" ? "emailInvalid" : "invalidValue";
      default:
        return "invalidValue";
    }
  },
});

export { z };
