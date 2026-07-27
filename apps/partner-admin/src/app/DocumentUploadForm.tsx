"use client";

import { useState } from "react";

type UploadResponse = {
  upload?: { documentId: string; storagePath: string; url: string; fields: Record<string, string>; maxBytes: number };
  error?: { message?: string };
};

const documentTypes = [
  ["power_of_attorney", "Доверенность / полномочия"],
  ["title_document", "Правоустанавливающий документ"],
  ["ownership_certificate", "Подтверждение собственности"],
  ["cadastral_extract", "Кадастровая выписка"],
  ["sale_purchase_agreement", "Договор купли-продажи"],
  ["lease_agreement", "Договор аренды"],
  ["other", "Другой документ"],
] as const;

export function DocumentUploadForm({ objectId }: { objectId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) { setMessage("Выберите файл."); return; }
    setBusy(true);
    setMessage(null);
    try {
      const documentType = String(formData.get("documentType") ?? "other");
      const title = String(formData.get("title") ?? "");
      const policyResponse = await fetch(`/api/v1/admin/objects/${encodeURIComponent(objectId)}/documents/upload-url`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ originalFileName: file.name, mimeType: file.type || "application/octet-stream" }) });
      const policy = (await policyResponse.json()) as UploadResponse;
      if (!policyResponse.ok || !policy.upload) throw new Error(policy.error?.message ?? "Не удалось подготовить загрузку.");
      if (file.size > policy.upload.maxBytes) throw new Error("Файл превышает допустимый размер 50 МБ.");
      const storageForm = new FormData();
      for (const [key, value] of Object.entries(policy.upload.fields)) storageForm.append(key, value);
      storageForm.append("file", file);
      const storageResponse = await fetch(policy.upload.url, { method: "POST", body: storageForm });
      if (!storageResponse.ok) throw new Error(`Cloud Storage upload failed: ${storageResponse.status}`);
      const confirmResponse = await fetch(`/api/v1/admin/objects/${encodeURIComponent(objectId)}/documents/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId: policy.upload.documentId, storagePath: policy.upload.storagePath, originalFileName: file.name, documentType, title }) });
      const confirmPayload = await confirmResponse.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!confirmResponse.ok) throw new Error(confirmPayload?.error?.message ?? "Не удалось подтвердить загрузку документа.");
      setMessage("Документ загружен. Теперь его можно использовать как подтверждение полномочий агентства.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка загрузки документа.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={upload} className="mb-4 grid gap-3 rounded-md border border-kv-line bg-kv-bg p-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="text-[13px] font-bold text-kv-muted">Тип документа<select name="documentType" defaultValue="power_of_attorney" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink">{documentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-[13px] font-bold text-kv-muted">Название<input name="title" className="mt-1 h-11 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink" /></label>
      <label className="text-[13px] font-bold text-kv-muted md:col-span-2">Файл PDF, DOC, DOCX, XLS, XLSX, TXT, JPG или PNG<input name="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png" className="mt-1 block w-full rounded-md border border-kv-line bg-white px-3 py-2 text-kv-ink" /></label>
      <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? "Загрузка…" : "Загрузить документ"}</button>
      {message ? <div className="text-[13px] font-bold text-kv-muted md:col-span-2 xl:col-span-3">{message}</div> : null}
    </form>
  );
}
