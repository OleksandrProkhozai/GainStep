import type { Locale } from "@/i18n/config";

/** Дата останнього оновлення документів (ISO). */
export const LEGAL_UPDATED_AT = "2026-11-23";

/** Контакт для питань щодо даних. TODO: замінити на справжню адресу. */
export const LEGAL_CONTACT_EMAIL = "your-email@example.com";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

export type LegalDocument = {
  intro: string;
  sections: LegalSection[];
};

const PRIVACY: Record<Locale, LegalDocument> = {
  uk: {
    intro:
      "GainStep — щоденник силових тренувань. Тут коротко описано, які дані застосунок збирає і що з ними відбувається.",
    sections: [
      {
        heading: "Які дані збираються",
        items: [
          "Email і ім'я — під час реєстрації або входу через Google (з Google ми отримуємо лише email, ім'я та фото профілю).",
          "Дані тренувань: програми, вправи, підходи, вага й повторення.",
          "Вага тіла, яку ви вносите, і налаштування застосунку (мова, одиниці, час відпочинку).",
        ],
      },
      {
        heading: "Навіщо",
        paragraphs: [
          "Дані використовуються лише для роботи застосунку: ведення щоденника тренувань, показу історії та графіків і розрахунку прогресії навантаження.",
        ],
      },
      {
        heading: "Де зберігаються",
        paragraphs: [
          "Дані зберігаються в базі даних Supabase. Доступ захищено політиками Row Level Security: кожен користувач бачить і змінює лише власні записи. Під час тренування частина даних тимчасово зберігається на вашому пристрої, щоб застосунок працював без мережі.",
        ],
      },
      {
        heading: "Передача третім особам",
        paragraphs: [
          "Ми не продаємо і не передаємо ваші дані третім особам і не використовуємо їх для реклами. У застосунку немає рекламних чи аналітичних трекерів.",
        ],
      },
      {
        heading: "Як видалити акаунт",
        paragraphs: [
          "Відкрийте Налаштування → Видалити акаунт. Це остаточно видаляє акаунт і всі пов'язані дані: профіль, програми, тренування й записи ваги тіла.",
        ],
      },
      {
        heading: "Контакт",
        paragraphs: [`З питань щодо ваших даних пишіть на ${LEGAL_CONTACT_EMAIL}.`],
      },
    ],
  },
  en: {
    intro:
      "GainStep is a strength training log. This page briefly describes what data the app collects and what happens to it.",
    sections: [
      {
        heading: "What we collect",
        items: [
          "Email and name — when you sign up or sign in with Google (from Google we receive only your email, name and profile picture).",
          "Workout data: programs, exercises, sets, weights and reps.",
          "Body weight you log, and app settings (language, units, rest time).",
        ],
      },
      {
        heading: "Why",
        paragraphs: [
          "The data is used only to run the app: keeping your training log, showing history and charts, and calculating load progression.",
        ],
      },
      {
        heading: "Where it is stored",
        paragraphs: [
          "Data is stored in a Supabase database. Access is protected by Row Level Security policies: each user can only see and change their own records. During a workout some data is kept temporarily on your device so the app works offline.",
        ],
      },
      {
        heading: "Sharing with third parties",
        paragraphs: [
          "We do not sell or share your data with third parties and do not use it for advertising. The app contains no advertising or analytics trackers.",
        ],
      },
      {
        heading: "Deleting your account",
        paragraphs: [
          "Open Settings → Delete account. This permanently deletes your account and all associated data: profile, programs, workouts and body weight entries.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [`For questions about your data, email ${LEGAL_CONTACT_EMAIL}.`],
      },
    ],
  },
};

const TERMS: Record<Locale, LegalDocument> = {
  uk: {
    intro: "Користуючись GainStep, ви погоджуєтеся з цими умовами.",
    sections: [
      {
        heading: "Навчальний проєкт",
        paragraphs: [
          "GainStep — навчальний застосунок, створений як дипломний проєкт. Він надається «як є», без гарантій безперебійної роботи чи збереження даних.",
        ],
      },
      {
        heading: "Не медична порада",
        paragraphs: [
          "Програми, рекомендації ваги та розрахунки прогресії мають інформаційний характер і не є медичною чи професійною порадою. Перед початком тренувань за наявності проблем зі здоров'ям проконсультуйтеся з лікарем.",
        ],
      },
      {
        heading: "Ваша відповідальність",
        paragraphs: [
          "Ви самі відповідаєте за техніку виконання вправ, вибір навантаження і власну безпеку під час тренувань.",
        ],
      },
      {
        heading: "Дані",
        paragraphs: ["Як обробляються ваші дані, описано в Політиці конфіденційності."],
      },
    ],
  },
  en: {
    intro: "By using GainStep you agree to these terms.",
    sections: [
      {
        heading: "Educational project",
        paragraphs: [
          "GainStep is an educational app built as a diploma project. It is provided “as is”, without guarantees of uninterrupted operation or data retention.",
        ],
      },
      {
        heading: "Not medical advice",
        paragraphs: [
          "Programs, weight suggestions and progression calculations are for information only and are not medical or professional advice. If you have health concerns, consult a doctor before training.",
        ],
      },
      {
        heading: "Your responsibility",
        paragraphs: [
          "You are solely responsible for your exercise technique, choice of load and your own safety while training.",
        ],
      },
      {
        heading: "Data",
        paragraphs: ["How your data is handled is described in the Privacy Policy."],
      },
    ],
  },
};

export function getLegalDocument(kind: "privacy" | "terms", locale: Locale): LegalDocument {
  return (kind === "privacy" ? PRIVACY : TERMS)[locale];
}
