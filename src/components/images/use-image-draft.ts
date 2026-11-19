"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { discardImage, ImageUploadError, uploadImage } from "./image-upload";

/**
 * Чернетка фото у формі (вправа, програма). Файл завантажується в bucket
 * одразу після вибору, а в рядок бази шлях потрапляє лише при збереженні.
 * Завантажені, але не збережені файли прибираються: при заміні іншим
 * фото, при «Стандартне фото» і при закритті форми без збереження.
 */
export function useImageDraft(bucket: string, initialPath: string | null) {
  const [supabase] = useState(createClient);
  const [path, setPath] = useState<string | null>(initialPath);
  const [uploading, setUploading] = useState(false);
  /** Код помилки errors.* або null. */
  const [error, setError] = useState<string | null>(null);
  const unsaved = useRef(new Set<string>());

  useEffect(() => {
    const paths = unsaved.current;
    return () => {
      for (const p of paths) void discardImage(supabase, bucket, p);
      paths.clear();
    };
  }, [supabase, bucket]);

  const dropUnsaved = (p: string | null) => {
    if (p && unsaved.current.delete(p)) void discardImage(supabase, bucket, p);
  };

  /** Вибраний файл → стискання й завантаження → новий шлях. */
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const next = await uploadImage(supabase, bucket, file);
      unsaved.current.add(next);
      dropUnsaved(path);
      setPath(next);
    } catch (e) {
      setError(e instanceof ImageUploadError ? e.code : "imageUploadFailed");
    } finally {
      setUploading(false);
    }
  };

  /** Повернутися до картинки за замовчуванням. */
  const reset = () => {
    dropUnsaved(path);
    setPath(null);
    setError(null);
  };

  /** Після успішного збереження: файл тепер належить запису — не прибирати. */
  const commit = () => unsaved.current.clear();

  return { path, uploading, error, setError, pick, reset, commit };
}
