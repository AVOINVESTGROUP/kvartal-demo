"use client";

import { useState } from "react";

type UploadResponse = {
  ok: boolean;
  upload?: {
    mediaId: string;
    storagePath: string;
    url: string;
    fields: Record<string, string>;
    maxBytes: number;
  };
  error?: { message?: string };
};

const kindOptions = [
  { value: "image", label: "Фото" },
  { value: "video", label: "Видео" },
  { value: "floor_plan", label: "План" },
  { value: "map", label: "Карта" },
  { value: "render", label: "Рендер" },
  { value: "drone", label: "Дрон" },
  { value: "other", label: "Другое" },
];

export function MediaUploadForm({ objectId }: { objectId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(formData: FormData) {
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setMessage("Выберите файл.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const kind = String(formData.get("kind") ?? "image");
      const title = String(formData.get("title") ?? "");
      const caption = String(formData.get("caption") ?? "");
      const isPublic = formData.get("public") === "on";
      const uploadResponse = await fetch(`/api/v1/admin/objects/${encodeURIComponent(objectId)}/media/upload-url`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          originalFileName: file.name,
          mimeType: file.type || "application/octet-stream",
          kind,
          public: isPublic,
          title,
          caption,
        }),
      });
      const uploadPayload = (await uploadResponse.json()) as UploadResponse;

      if (!uploadResponse.ok || !uploadPayload.upload) {
        throw new Error(uploadPayload.error?.message ?? "Не удалось получить upload URL.");
      }

      if (file.size > uploadPayload.upload.maxBytes) {
        throw new Error("Файл превышает допустимый размер.");
      }

      const gcsForm = new FormData();

      for (const [key, value] of Object.entries(uploadPayload.upload.fields)) {
        gcsForm.append(key, value);
      }

      gcsForm.append("file", file);

      const storageResponse = await fetch(uploadPayload.upload.url, {
        method: "POST",
        body: gcsForm,
      });

      if (!storageResponse.ok) {
        throw new Error(`Cloud Storage upload failed: ${storageResponse.status}`);
      }

      const confirmResponse = await fetch(`/api/v1/admin/objects/${encodeURIComponent(objectId)}/media/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaId: uploadPayload.upload.mediaId,
          storagePath: uploadPayload.upload.storagePath,
          originalFileName: file.name,
          kind,
          public: isPublic,
          title,
          caption,
        }),
      });

      if (!confirmResponse.ok) {
        const details = await confirmResponse.text();
        throw new Error(details || "Не удалось подтвердить загрузку.");
      }

      setMessage("Файл загружен.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка загрузки.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={upload} className="grid gap-3 rounded-md border border-kv-line bg-kv-bg p-3 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-[13px] font-bold text-kv-muted">
        Тип медиа
        <select name="kind" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" defaultValue="image">
          {kindOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[13px] font-bold text-kv-muted">
        Название
        <input name="title" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
      </label>
      <label className="text-[13px] font-bold text-kv-muted">
        Подпись
        <input name="caption" className="mt-1 h-11 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
      </label>
      <label className="flex min-h-11 items-end gap-2 text-[13px] font-bold text-kv-muted">
        <input name="public" type="checkbox" defaultChecked />
        Публичное медиа
      </label>
      <label className="text-[13px] font-bold text-kv-muted md:col-span-2 xl:col-span-3">
        Файл
        <input name="file" type="file" accept="image/*,video/*,application/pdf" className="mt-1 block w-full rounded-md border border-kv-line bg-white px-3 py-2 text-kv-ink" />
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={busy} className="min-h-11 w-full rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white disabled:opacity-60">
          {busy ? "Загрузка..." : "Загрузить"}
        </button>
      </div>
      {message ? <div className="text-[13px] font-bold text-kv-muted md:col-span-2 xl:col-span-4">{message}</div> : null}
    </form>
  );
}
