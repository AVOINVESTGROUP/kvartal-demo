"use client";

import { useState } from "react";

type UploadResponse = {
  ok: boolean;
  upload?: {
    attachmentId: string;
    storagePath: string;
    url: string;
    fields: Record<string, string>;
    maxBytes: number;
  };
  error?: { message?: string };
};

const acceptedFileTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
].join(",");

export function InteractionAttachmentUploadForm({ interactionId, officeSlug }: { interactionId: string; officeSlug: string }) {
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
      const uploadResponse = await fetch(`/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/attachments/upload-policy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          officeSlug,
          originalFileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
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

      const confirmResponse = await fetch(`/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/attachments/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          officeSlug,
          attachmentId: uploadPayload.upload.attachmentId,
          storagePath: uploadPayload.upload.storagePath,
          originalFileName: file.name,
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
    <form action={upload} className="rounded-md border border-kv-line bg-kv-bg p-3">
      <label className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">
        Вложение
        <input name="file" type="file" accept={acceptedFileTypes} className="mt-2 block w-full rounded-md border border-kv-line bg-white px-3 py-2 text-[13px] text-kv-ink" />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-navy disabled:opacity-60">
          {busy ? "Загрузка..." : "Загрузить файл"}
        </button>
        <span className="text-[11px] font-bold text-kv-muted">PDF, DOC, XLS, JPG, PNG, GIF · до 25 MB</span>
      </div>
      {message ? <div className="mt-2 text-[12px] font-bold text-kv-muted">{message}</div> : null}
    </form>
  );
}
