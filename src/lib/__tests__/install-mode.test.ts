import { describe, expect, it } from "vitest";

import { detectInstallMode, isIOS, isIOSSafari } from "../pwa/install-mode";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101",
  ipadOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
};

describe("визначення iOS / Safari", () => {
  it("iPhone і iPad (iPadOS видає себе за Mac, але має сенсорний екран)", () => {
    expect(isIOS(UA.iphoneSafari)).toBe(true);
    expect(isIOS(UA.ipadOS, 5)).toBe(true);
    expect(isIOS(UA.macSafari, 0)).toBe(false);
    expect(isIOS(UA.android)).toBe(false);
  });

  it("лише Safari — не Chrome на iOS і не вбудовані браузери", () => {
    expect(isIOSSafari(UA.iphoneSafari)).toBe(true);
    expect(isIOSSafari(UA.ipadOS, 5)).toBe(true);
    expect(isIOSSafari(UA.iphoneChrome)).toBe(false);
    expect(isIOSSafari(UA.iphoneInstagram)).toBe(false);
    expect(isIOSSafari(UA.macSafari, 0)).toBe(false);
  });
});

describe("режим встановлення", () => {
  it("уже відкрито як застосунок (standalone) — нічого не пропонуємо", () => {
    expect(detectInstallMode({ standalone: true, canPrompt: true, userAgent: UA.android })).toBe("installed");
    expect(detectInstallMode({ standalone: true, canPrompt: false, userAgent: UA.iphoneSafari })).toBe("installed");
  });

  it("Chrome / Android з подією beforeinstallprompt — кнопка", () => {
    expect(detectInstallMode({ standalone: false, canPrompt: true, userAgent: UA.android })).toBe("prompt");
  });

  it("Safari на iPhone без standalone — підказка «Поділитися → На екран „Додому“»", () => {
    expect(detectInstallMode({ standalone: false, canPrompt: false, userAgent: UA.iphoneSafari })).toBe("ios");
  });

  it("події немає й це не iOS Safari — нічого", () => {
    expect(detectInstallMode({ standalone: false, canPrompt: false, userAgent: UA.android })).toBe("none");
    expect(detectInstallMode({ standalone: false, canPrompt: false, userAgent: UA.iphoneChrome })).toBe("none");
    expect(detectInstallMode({ standalone: false, canPrompt: false, userAgent: UA.macSafari })).toBe("none");
  });
});
