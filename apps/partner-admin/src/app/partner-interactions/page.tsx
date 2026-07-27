import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "../../lib/auth";
import { deleteBackendJson, fetchBackendJson, writeBackendJson } from "../../lib/server-api";
import { InteractionAttachmentUploadForm } from "./InteractionAttachmentUploadForm";
import { InteractionMessageComposer } from "./InteractionMessageComposer";

export const dynamic = "force-dynamic";

type AdminContextResponse = {
  organization: {
    slug: string;
    legalName: string;
    defaultLanguage: string;
    offices: Array<{
      slug: string;
      legalName: string;
      city: string;
      country: string;
    }>;
  };
};

type PartnerSummary = {
  id: string;
  slug: string;
  legalName: string;
  defaultLanguage: string;
  primaryOffice: { id: string; slug: string; legalName: string; city: string; country: string } | null;
  sharedObjectCount: number;
  activeInteractionCount: number;
  unreadMessageCount: number;
  metrics: {
    averageFirstResponseSec: number | null;
    completedDealsCount: number;
    acceptanceRatePercent: string | null;
    rating: string | null;
  };
};

type PartnerObject = {
  id: string;
  partnerOfferId: string;
  title: string;
  addressDisplay: string | null;
  assetClass: string;
  priceDisplay: string | null;
  priceAmount: string | null;
  priceCurrency: string | null;
  market: { city: string; country: string };
  sellerSide: { organizationName: string; officeName: string };
  media: Array<{ url: string; kind: string }>;
};

type ClientIntent = {
  id: string;
  requirementText: string;
  status: string;
  preferredLanguage: string;
  preferredCurrency: string;
  market: { id: string; city: string; country: string } | null;
  updatedAt: string;
};

type InteractionMessage = {
  id: string;
  sender: {
    organizationName: string;
    officeName: string;
    ownOrganization: boolean;
  };
  originalText: string;
  originalLanguage: string;
  translatedText: string | null;
  translatedLanguage: string | null;
  translationStatus: string;
  deliveryStatus: string;
  readAt: string | null;
  deleted: boolean;
  createdAt: string;
};

type PartnerInteraction = {
  id: string;
  type: string;
  priority: string;
  status: string;
  conversationLanguage: string;
  subject: string | null;
  initialMessage: string | null;
  remindedAt: string | null;
  escalatedAt: string | null;
  completedAt: string | null;
  dealRoomId: string | null;
  createdAt: string;
  updatedAt: string;
  initiatingPartner: { organizationName: string; officeName: string };
  targetPartner: { organizationName: string; officeName: string };
  object: PartnerObject;
  messages: InteractionMessage[];
  attachments: Array<{
    id: string;
    messageId: string | null;
    originalFileName: string;
    mimeType: string;
    sizeBytes: string;
    scanStatus: string;
    deleted: boolean;
    url: string;
    createdAt: string;
  }>;
  reviews: Array<{
    id: string;
    reviewer: {
      organizationSlug: string;
      organizationName: string;
      ownOrganization: boolean;
    };
    reviewed: {
      organizationSlug: string;
      organizationName: string;
    };
    rating: number;
    text: string | null;
    hiddenByPlatform: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  events: Array<{ id: string; eventType: string; payload: unknown; createdAt: string }>;
};

type InteractionTemplate = {
  id: string;
  organizationId: string | null;
  name: string;
  text: string;
  type: string;
  system: boolean;
};

type BlockedPartner = {
  id: string;
  partner: {
    id: string;
    slug: string;
    legalName: string;
    primaryOffice: { id: string; slug: string; legalName: string } | null;
  };
  reason: string | null;
  createdAt: string;
};

type NotificationSettings = {
  inAdminEnabled: boolean;
  telegramEnabled: boolean;
  telegramChatId: string | null;
  whatsappEnabled: boolean;
  whatsappPhoneE164: string | null;
  whatsappTemplateName: string | null;
  urgentExternalEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

type InteractionNotification = {
  id: string;
  interactionId: string;
  messageId: string | null;
  eventType: string;
  title: string;
  body: string;
  status: string;
  readAt: string | null;
  createdAt: string;
};

type SearchParams = Record<string, string | string[] | undefined>;
const supportedInteractionLanguages = ["ru", "en", "ka", "hy", "ar"];

function value(params: SearchParams, key: string) {
  const item = params[key];
  return Array.isArray(item) ? item[0] : item;
}

function formValue(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new_request: "Новый запрос",
    waiting_response: "Ожидает ответа",
    information_received: "Информация получена",
    accepted: "Согласовано",
    declined: "Отклонено",
    in_deal: "В сделке",
    completed: "Завершено",
    archived: "Архив",
  };

  return labels[status] ?? status;
}

function typeLabel(type: string) {
  const labels: Record<string, string> = {
    info_request: "Информационный",
    commercial: "Коммерческий",
    cooperation: "Кооперация",
  };

  return labels[type] ?? type;
}

function priorityLabel(priority: string) {
  const labels: Record<string, string> = {
    normal: "Обычный",
    urgent: "Срочный",
    critical: "Очень срочный",
  };

  return labels[priority] ?? priority;
}

function attachmentScanStatusLabel(scanStatus: string) {
  const labels: Record<string, string> = {
    scan_pending: "Проверяется",
    clean: "Проверен",
    blocked: "Заблокирован",
    failed: "Ошибка проверки",
  };

  return labels[scanStatus] ?? scanStatus;
}

function resolveMediaUrl(url: string | undefined) {
  if (!url) return null;
  if (url.startsWith("/api/")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const baseUrl = process.env.PUBLIC_SITE_BASE_URL ?? "https://partner-site-dev--kvartal-dev.europe-west4.hosted.app";
  return `${baseUrl}${url}`;
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "danger" | "dark" }) {
  const toneClass = {
    neutral: "border-kv-line bg-white text-kv-muted",
    good: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    dark: "border-kv-navy bg-kv-navy text-white",
  }[tone];

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-black ${toneClass}`}>{children}</span>;
}

async function createInteractionAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const response = await writeBackendJson<{ interaction: { id: string } }>(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/interactions", "POST", {
    organizationSlug: session.organizationSlug,
    officeSlug: formValue(formData, "officeSlug"),
    partnerOfferId: formValue(formData, "partnerOfferId"),
    clientIntentId: formValue(formData, "clientIntentId"),
    type: formValue(formData, "type"),
    priority: formValue(formData, "priority"),
    subject: formValue(formData, "subject"),
    message: formValue(formData, "message"),
    conversationLanguage: formValue(formData, "conversationLanguage"),
    actorEmail: session.email,
    actorName: session.name,
  });

  revalidatePath("/partner-interactions");
  redirect(`/partner-interactions?partner=${encodeURIComponent(formValue(formData, "partnerId"))}&interaction=${encodeURIComponent(response?.interaction.id ?? "")}`);
}

async function sendMessageAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const interactionId = formValue(formData, "interactionId");

  await writeBackendJson(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/messages`, "POST", {
    organizationSlug: session.organizationSlug,
    officeSlug: formValue(formData, "officeSlug"),
    message: formValue(formData, "message"),
    originalLanguage: formValue(formData, "originalLanguage") || formValue(formData, "conversationLanguage"),
    actorEmail: session.email,
    actorName: session.name,
  });

  revalidatePath("/partner-interactions");
}

async function translateMessageAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const interactionId = formValue(formData, "interactionId");
  const messageId = formValue(formData, "messageId");

  await writeBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/messages/${encodeURIComponent(messageId)}/translate`,
    "POST",
    {
      organizationSlug: session.organizationSlug,
      officeSlug: formValue(formData, "officeSlug"),
      targetLanguage: formValue(formData, "targetLanguage"),
      actorEmail: session.email,
      actorName: session.name,
    },
  );

  revalidatePath("/partner-interactions");
}

async function editMessageTranslationAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const interactionId = formValue(formData, "interactionId");
  const messageId = formValue(formData, "messageId");

  await writeBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/messages/${encodeURIComponent(messageId)}/translation-edit`,
    "POST",
    {
      organizationSlug: session.organizationSlug,
      officeSlug: formValue(formData, "officeSlug"),
      translatedText: formValue(formData, "translatedText"),
      translatedLanguage: formValue(formData, "translatedLanguage"),
      actorEmail: session.email,
      actorName: session.name,
    },
  );

  revalidatePath("/partner-interactions");
}

async function updateStatusAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const interactionId = formValue(formData, "interactionId");

  await writeBackendJson(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}`, "PATCH", {
    organizationSlug: session.organizationSlug,
    officeSlug: formValue(formData, "officeSlug"),
    status: formValue(formData, "status"),
    actorEmail: session.email,
    actorName: session.name,
  });

  revalidatePath("/partner-interactions");
}

async function sendReminderAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const interactionId = formValue(formData, "interactionId");

  await writeBackendJson(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/reminder`, "POST", {
    organizationSlug: session.organizationSlug,
    officeSlug: formValue(formData, "officeSlug"),
    message: formValue(formData, "message"),
    actorEmail: session.email,
    actorName: session.name,
  });

  revalidatePath("/partner-interactions");
}

async function escalateInteractionAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const interactionId = formValue(formData, "interactionId");

  await writeBackendJson(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/escalate`, "POST", {
    organizationSlug: session.organizationSlug,
    officeSlug: formValue(formData, "officeSlug"),
    reason: formValue(formData, "reason"),
    actorEmail: session.email,
    actorName: session.name,
  });

  revalidatePath("/partner-interactions");
}

async function submitReviewAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const interactionId = formValue(formData, "interactionId");

  await writeBackendJson(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/reviews`, "POST", {
    organizationSlug: session.organizationSlug,
    officeSlug: formValue(formData, "officeSlug"),
    rating: formValue(formData, "rating"),
    text: formValue(formData, "text"),
    actorEmail: session.email,
    actorName: session.name,
  });

  revalidatePath("/partner-interactions");
}

async function openDealRoomAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const interactionId = formValue(formData, "interactionId");

  await writeBackendJson(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/deal-room`, "POST", {
    organizationSlug: session.organizationSlug,
    officeSlug: formValue(formData, "officeSlug"),
    note: formValue(formData, "note"),
    actorEmail: session.email,
    actorName: session.name,
  });

  revalidatePath("/partner-interactions");
}

async function exportInteractionPdfAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const interactionId = formValue(formData, "interactionId");
  const response = await writeBackendJson<{ export: { url: string } }>(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/interactions/${encodeURIComponent(interactionId)}/export-pdf`,
    "POST",
    {
      organizationSlug: session.organizationSlug,
      officeSlug: formValue(formData, "officeSlug"),
      language: formValue(formData, "language"),
      actorEmail: session.email,
      actorName: session.name,
    },
  );

  if (response?.export.url) {
    redirect(response.export.url);
  }

  revalidatePath("/partner-interactions");
}

async function createTemplateAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();

  await writeBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/interaction-templates", "POST", {
    organizationSlug: session.organizationSlug,
    officeSlug: formValue(formData, "officeSlug"),
    name: formValue(formData, "name"),
    text: formValue(formData, "text"),
    type: formValue(formData, "type"),
  });

  revalidatePath("/partner-interactions");
}

async function deleteTemplateAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const templateId = formValue(formData, "templateId");
  const officeSlug = formValue(formData, "officeSlug");

  await deleteBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/interaction-templates/${encodeURIComponent(templateId)}?organizationSlug=${encodeURIComponent(session.organizationSlug)}&officeSlug=${encodeURIComponent(officeSlug)}`,
  );

  revalidatePath("/partner-interactions");
}

async function blockPartnerAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const partnerId = formValue(formData, "partnerId");

  await writeBackendJson(process.env.PARTNER_API_BASE_URL, `/api/v1/admin/blocked-partners/${encodeURIComponent(partnerId)}`, "POST", {
    organizationSlug: session.organizationSlug,
    officeSlug: formValue(formData, "officeSlug"),
    reason: formValue(formData, "reason"),
  });

  revalidatePath("/partner-interactions");
}

async function unblockPartnerAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const partnerId = formValue(formData, "partnerId");
  const officeSlug = formValue(formData, "officeSlug");

  await deleteBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/blocked-partners/${encodeURIComponent(partnerId)}?organizationSlug=${encodeURIComponent(session.organizationSlug)}&officeSlug=${encodeURIComponent(officeSlug)}`,
  );

  revalidatePath("/partner-interactions");
}

async function updateNotificationSettingsAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();

  await writeBackendJson(process.env.PARTNER_API_BASE_URL, "/api/v1/admin/organization/notification-settings", "PATCH", {
    organizationSlug: session.organizationSlug,
    inAdminEnabled: formValue(formData, "inAdminEnabled"),
    telegramEnabled: formValue(formData, "telegramEnabled"),
    telegramChatId: formValue(formData, "telegramChatId"),
    whatsappEnabled: formValue(formData, "whatsappEnabled"),
    whatsappPhoneE164: formValue(formData, "whatsappPhoneE164"),
    whatsappTemplateName: formValue(formData, "whatsappTemplateName"),
    urgentExternalEnabled: formValue(formData, "urgentExternalEnabled"),
    quietHoursStart: formValue(formData, "quietHoursStart"),
    quietHoursEnd: formValue(formData, "quietHoursEnd"),
  });

  revalidatePath("/partner-interactions");
}

async function markNotificationReadAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const notificationId = formValue(formData, "notificationId");

  await writeBackendJson(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/interactions/notifications/${encodeURIComponent(notificationId)}/read`,
    "PATCH",
    {
      organizationSlug: session.organizationSlug,
      officeSlug: formValue(formData, "officeSlug"),
    },
  );

  revalidatePath("/partner-interactions");
}

export default async function PartnerInteractionsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await requireAdminSession();
  const params = (await searchParams) ?? {};
  const organizationSlug = session.organizationSlug;
  const context = await fetchBackendJson<AdminContextResponse>(
    process.env.PARTNER_API_BASE_URL,
    `/api/v1/admin/context?organizationSlug=${encodeURIComponent(organizationSlug)}`,
  );
  const offices = context?.organization.offices ?? [];
  const activeOfficeSlug = value(params, "office") ?? offices[0]?.slug ?? "";
  const searchQuery = value(params, "q") ?? "";
  const [partnersResponse, interactionsResponse, templatesResponse, blockedPartnersResponse, notificationSettingsResponse, notificationsResponse, clientIntentsResponse] = await Promise.all([
    fetchBackendJson<{ partners: PartnerSummary[] }>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/partners?organizationSlug=${encodeURIComponent(organizationSlug)}&officeSlug=${encodeURIComponent(activeOfficeSlug)}`,
    ),
    fetchBackendJson<{ interactions: PartnerInteraction[] }>(
      process.env.PARTNER_API_BASE_URL,
      searchQuery.length >= 2
        ? `/api/v1/admin/interactions/search?organizationSlug=${encodeURIComponent(organizationSlug)}&officeSlug=${encodeURIComponent(activeOfficeSlug)}&language=ru&limit=50&q=${encodeURIComponent(searchQuery)}`
        : `/api/v1/admin/interactions?organizationSlug=${encodeURIComponent(organizationSlug)}&officeSlug=${encodeURIComponent(activeOfficeSlug)}&language=ru&limit=50`,
    ),
    fetchBackendJson<{ templates: InteractionTemplate[] }>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/interaction-templates?organizationSlug=${encodeURIComponent(organizationSlug)}&officeSlug=${encodeURIComponent(activeOfficeSlug)}`,
    ),
    fetchBackendJson<{ blockedPartners: BlockedPartner[] }>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/blocked-partners?organizationSlug=${encodeURIComponent(organizationSlug)}&officeSlug=${encodeURIComponent(activeOfficeSlug)}`,
    ),
    fetchBackendJson<{ settings: NotificationSettings }>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/organization/notification-settings?organizationSlug=${encodeURIComponent(organizationSlug)}`,
    ),
    fetchBackendJson<{ unreadCount: number; notifications: InteractionNotification[] }>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/interactions/notifications?organizationSlug=${encodeURIComponent(organizationSlug)}&officeSlug=${encodeURIComponent(activeOfficeSlug)}&limit=8`,
    ),
    fetchBackendJson<{ clientIntents: ClientIntent[] }>(
      process.env.PARTNER_API_BASE_URL,
      `/api/v1/admin/client-intents?organizationSlug=${encodeURIComponent(organizationSlug)}&officeSlug=${encodeURIComponent(activeOfficeSlug)}&limit=100`,
    ),
  ]);
  const partners = partnersResponse?.partners ?? [];
  const templates = templatesResponse?.templates ?? [];
  const blockedPartners = blockedPartnersResponse?.blockedPartners ?? [];
  const notificationSettings = notificationSettingsResponse?.settings;
  const notifications = notificationsResponse?.notifications ?? [];
  const unreadNotificationCount = notificationsResponse?.unreadCount ?? 0;
  const clientIntents = clientIntentsResponse?.clientIntents ?? [];
  const blockedPartnerIds = new Set(blockedPartners.map((item) => item.partner.id));
  const selectedPartnerId = value(params, "partner") ?? partners[0]?.id ?? "";
  const selectedPartner = partners.find((partner) => partner.id === selectedPartnerId || partner.slug === selectedPartnerId) ?? partners[0];
  const selectedTemplateId = value(params, "template");
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const selectedInteractionId = value(params, "interaction");
  const languageOptions = Array.from(new Set([...supportedInteractionLanguages, context?.organization.defaultLanguage, selectedPartner?.defaultLanguage].filter(Boolean) as string[]));
  const [partnerObjectsResponse, interactionDetailResponse] = await Promise.all([
    selectedPartner
      ? fetchBackendJson<{ objects: PartnerObject[] }>(
          process.env.PARTNER_API_BASE_URL,
          `/api/v1/admin/partners/${encodeURIComponent(selectedPartner.id)}/objects?organizationSlug=${encodeURIComponent(organizationSlug)}&officeSlug=${encodeURIComponent(activeOfficeSlug)}&language=ru`,
        )
      : Promise.resolve(null),
    selectedInteractionId
      ? fetchBackendJson<{ interaction: PartnerInteraction }>(
          process.env.PARTNER_API_BASE_URL,
          `/api/v1/admin/interactions/${encodeURIComponent(selectedInteractionId)}?organizationSlug=${encodeURIComponent(organizationSlug)}&officeSlug=${encodeURIComponent(activeOfficeSlug)}&language=ru`,
        )
      : Promise.resolve(null),
  ]);
  const partnerObjects = partnerObjectsResponse?.objects ?? [];
  const interactions = interactionsResponse?.interactions ?? [];
  const selectedInteraction = interactionDetailResponse?.interaction ?? interactions.find((interaction) => interaction.id === selectedInteractionId) ?? null;

  return (
    <main className="min-h-screen bg-kv-bg text-kv-ink">
      <header className="border-b border-kv-line bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.18em] text-kv-red">Fixer.guru Partner Admin</div>
            <h1 className="mt-2 text-[30px] font-black tracking-tight text-kv-navy">Взаимодействия партнёров</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="rounded-full border border-kv-line bg-white px-4 py-2 text-[13px] font-black text-kv-navy">Объекты</Link>
            <form action="/partner-interactions" method="get">
              {selectedPartner ? <input type="hidden" name="partner" value={selectedPartner.id} /> : null}
              {selectedInteractionId ? <input type="hidden" name="interaction" value={selectedInteractionId} /> : null}
              <select name="office" defaultValue={activeOfficeSlug} className="h-10 rounded-md border border-kv-line bg-white px-3 text-[13px] font-bold text-kv-ink">
                {offices.map((office) => (
                  <option key={office.slug} value={office.slug}>{office.legalName}</option>
                ))}
              </select>
              <button className="ml-2 rounded-full bg-kv-navy px-4 py-2 text-[13px] font-black text-white">Сменить офис</button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1440px] gap-5 px-6 py-6 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-md border border-kv-line bg-white">
            <div className="flex items-center justify-between border-b border-kv-line px-4 py-3">
              <div className="text-[13px] font-black uppercase tracking-[0.12em] text-kv-muted">Уведомления</div>
              {unreadNotificationCount ? <Badge tone="danger">{unreadNotificationCount}</Badge> : <Badge>0</Badge>}
            </div>
            <div className="divide-y divide-kv-line">
              {notifications.map((notification) => (
                <div key={notification.id} className="p-4">
                  <a
                    href={`/partner-interactions?office=${encodeURIComponent(activeOfficeSlug)}&interaction=${encodeURIComponent(notification.interactionId)}`}
                    className="block"
                  >
                    <div className="text-[13px] font-black text-kv-navy">{notification.title}</div>
                    <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-kv-muted">{notification.body}</div>
                    <div className="mt-2 text-[11px] font-bold text-kv-muted">
                      {notification.eventType} · {new Date(notification.createdAt).toLocaleString("ru-RU")}
                    </div>
                  </a>
                  {!notification.readAt ? (
                    <form action={markNotificationReadAction} className="mt-2">
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                      <button className="text-[12px] font-bold text-kv-red">Отметить прочитанным</button>
                    </form>
                  ) : null}
                </div>
              ))}
              {!notifications.length ? <div className="p-4 text-[13px] text-kv-muted">Новых уведомлений нет.</div> : null}
            </div>
          </div>

          <div className="rounded-md border border-kv-line bg-white">
            <div className="border-b border-kv-line px-4 py-3 text-[13px] font-black uppercase tracking-[0.12em] text-kv-muted">Telegram / WhatsApp</div>
            <form action={updateNotificationSettingsAction} className="space-y-3 p-4">
              <label className="block text-[12px] font-bold text-kv-muted">
                In-admin
                <select name="inAdminEnabled" defaultValue={String(notificationSettings?.inAdminEnabled ?? true)} className="mt-1 h-9 w-full rounded border border-kv-line bg-white px-2 text-[12px] text-kv-ink">
                  <option value="true">Включено</option>
                  <option value="false">Выключено</option>
                </select>
              </label>
              <label className="block text-[12px] font-bold text-kv-muted">
                Telegram
                <select name="telegramEnabled" defaultValue={String(notificationSettings?.telegramEnabled ?? false)} className="mt-1 h-9 w-full rounded border border-kv-line bg-white px-2 text-[12px] text-kv-ink">
                  <option value="false">Выключен</option>
                  <option value="true">Включен</option>
                </select>
              </label>
              <input name="telegramChatId" defaultValue={notificationSettings?.telegramChatId ?? ""} placeholder="Telegram chat id" className="h-9 w-full rounded border border-kv-line px-2 text-[12px] text-kv-ink" />
              <label className="block text-[12px] font-bold text-kv-muted">
                WhatsApp
                <select name="whatsappEnabled" defaultValue={String(notificationSettings?.whatsappEnabled ?? false)} className="mt-1 h-9 w-full rounded border border-kv-line bg-white px-2 text-[12px] text-kv-ink">
                  <option value="false">Выключен</option>
                  <option value="true">Включен</option>
                </select>
              </label>
              <input name="whatsappPhoneE164" defaultValue={notificationSettings?.whatsappPhoneE164 ?? ""} placeholder="+995555000000" className="h-9 w-full rounded border border-kv-line px-2 text-[12px] text-kv-ink" />
              <input name="whatsappTemplateName" defaultValue={notificationSettings?.whatsappTemplateName ?? ""} placeholder="WhatsApp template name" className="h-9 w-full rounded border border-kv-line px-2 text-[12px] text-kv-ink" />
              <label className="block text-[12px] font-bold text-kv-muted">
                Срочные внешние уведомления
                <select name="urgentExternalEnabled" defaultValue={String(notificationSettings?.urgentExternalEnabled ?? true)} className="mt-1 h-9 w-full rounded border border-kv-line bg-white px-2 text-[12px] text-kv-ink">
                  <option value="true">Включены</option>
                  <option value="false">Выключены</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input name="quietHoursStart" defaultValue={notificationSettings?.quietHoursStart ?? ""} placeholder="quiet from" className="h-9 rounded border border-kv-line px-2 text-[12px] text-kv-ink" />
                <input name="quietHoursEnd" defaultValue={notificationSettings?.quietHoursEnd ?? ""} placeholder="quiet to" className="h-9 rounded border border-kv-line px-2 text-[12px] text-kv-ink" />
              </div>
              <button className="w-full rounded-full bg-kv-navy px-4 py-2 text-[12px] font-black text-white">Сохранить каналы</button>
            </form>
          </div>

          <div className="rounded-md border border-kv-line bg-white">
            <div className="border-b border-kv-line px-4 py-3 text-[13px] font-black uppercase tracking-[0.12em] text-kv-muted">Партнёры</div>
            <div className="divide-y divide-kv-line">
              {partners.map((partner) => (
                <a
                  key={partner.id}
                  href={`/partner-interactions?office=${encodeURIComponent(activeOfficeSlug)}&partner=${encodeURIComponent(partner.id)}`}
                  className={`block px-4 py-3 ${selectedPartner?.id === partner.id ? "bg-kv-bg" : "bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-kv-navy">{partner.legalName}</div>
                      <div className="mt-1 text-[12px] text-kv-muted">{partner.primaryOffice?.city ?? "Office"} · {partner.sharedObjectCount} объектов</div>
                    </div>
                    {partner.unreadMessageCount ? <Badge tone="danger">{partner.unreadMessageCount}</Badge> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>{partner.activeInteractionCount} активных</Badge>
                    <Badge tone={partner.metrics.rating ? "good" : "neutral"}>{partner.metrics.rating ?? "нет рейтинга"}</Badge>
                    {blockedPartnerIds.has(partner.id) ? <Badge tone="danger">заблокирован</Badge> : null}
                  </div>
                </a>
              ))}
              {!partners.length ? <div className="p-4 text-[13px] text-kv-muted">Партнёры не найдены.</div> : null}
            </div>
          </div>

          <div className="rounded-md border border-kv-line bg-white">
            <div className="border-b border-kv-line px-4 py-3 text-[13px] font-black uppercase tracking-[0.12em] text-kv-muted">История</div>
            <form action="/partner-interactions" method="get" className="border-b border-kv-line p-3">
              <input type="hidden" name="office" value={activeOfficeSlug} />
              {selectedPartner ? <input type="hidden" name="partner" value={selectedPartner.id} /> : null}
              <div className="flex gap-2">
                <input
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="Поиск"
                  className="h-9 min-w-0 flex-1 rounded-md border border-kv-line px-3 text-[13px] text-kv-ink"
                />
                <button className="rounded-full bg-kv-navy px-4 py-2 text-[12px] font-black text-white">Найти</button>
              </div>
              {searchQuery ? <a href={`/partner-interactions?office=${encodeURIComponent(activeOfficeSlug)}&partner=${encodeURIComponent(selectedPartner?.id ?? "")}`} className="mt-2 inline-block text-[12px] font-bold text-kv-muted">Сбросить поиск</a> : null}
            </form>
            <div className="divide-y divide-kv-line">
              {interactions.map((interaction) => (
                <a
                  key={interaction.id}
                  href={`/partner-interactions?office=${encodeURIComponent(activeOfficeSlug)}&partner=${encodeURIComponent(
                    selectedPartner?.id ?? "",
                  )}&interaction=${encodeURIComponent(interaction.id)}`}
                  className={`block px-4 py-3 ${selectedInteraction?.id === interaction.id ? "bg-kv-bg" : "bg-white"}`}
                >
                  <div className="font-black text-kv-navy">{interaction.subject || interaction.object.title}</div>
                  <div className="mt-1 text-[12px] text-kv-muted">{statusLabel(interaction.status)} · {typeLabel(interaction.type)}</div>
                </a>
              ))}
              {!interactions.length ? <div className="p-4 text-[13px] text-kv-muted">История пока пустая.</div> : null}
            </div>
          </div>

          <div className="rounded-md border border-kv-line bg-white">
            <div className="border-b border-kv-line px-4 py-3 text-[13px] font-black uppercase tracking-[0.12em] text-kv-muted">Шаблоны</div>
            <div className="space-y-3 p-4">
              <div className="space-y-2">
                {templates.slice(0, 6).map((template) => (
                  <a
                    key={template.id}
                    href={`/partner-interactions?office=${encodeURIComponent(activeOfficeSlug)}&partner=${encodeURIComponent(selectedPartner?.id ?? "")}&template=${encodeURIComponent(template.id)}`}
                    className={`block rounded-md border px-3 py-2 text-[12px] ${selectedTemplate?.id === template.id ? "border-kv-navy bg-kv-bg" : "border-kv-line bg-white"}`}
                  >
                    <span className="block font-black text-kv-navy">{template.name}</span>
                    <span className="mt-1 line-clamp-2 block text-kv-muted">{template.text}</span>
                  </a>
                ))}
              </div>
              <details className="rounded-md border border-kv-line bg-kv-bg">
                <summary className="cursor-pointer px-3 py-2 text-[12px] font-black text-kv-navy">Создать шаблон</summary>
                <form action={createTemplateAction} className="space-y-2 border-t border-kv-line p-3">
                  <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                  <input name="name" required placeholder="Название" className="h-9 w-full rounded border border-kv-line px-2 text-[12px] text-kv-ink" />
                  <select name="type" defaultValue="info_request" className="h-9 w-full rounded border border-kv-line bg-white px-2 text-[12px] text-kv-ink">
                    <option value="info_request">Информационный</option>
                    <option value="commercial">Коммерческий</option>
                    <option value="cooperation">Кооперация</option>
                  </select>
                  <textarea name="text" required placeholder="Текст шаблона" className="min-h-[88px] w-full rounded border border-kv-line px-2 py-2 text-[12px] text-kv-ink" />
                  <button className="rounded-full bg-kv-navy px-4 py-2 text-[12px] font-black text-white">Сохранить</button>
                </form>
              </details>
              {templates.filter((template) => !template.system).map((template) => (
                <form key={template.id} action={deleteTemplateAction}>
                  <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                  <input type="hidden" name="templateId" value={template.id} />
                  <button className="text-[12px] font-bold text-kv-red">Удалить шаблон: {template.name}</button>
                </form>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-kv-line bg-white">
            <div className="border-b border-kv-line px-4 py-3 text-[13px] font-black uppercase tracking-[0.12em] text-kv-muted">Блокировки</div>
            <div className="space-y-3 p-4">
              {selectedPartner ? (
                blockedPartnerIds.has(selectedPartner.id) ? (
                  <form action={unblockPartnerAction}>
                    <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                    <input type="hidden" name="partnerId" value={selectedPartner.id} />
                    <button className="w-full rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-navy">Разблокировать {selectedPartner.legalName}</button>
                  </form>
                ) : (
                  <details className="rounded-md border border-kv-line bg-kv-bg">
                    <summary className="cursor-pointer px-3 py-2 text-[12px] font-black text-kv-navy">Заблокировать выбранного партнёра</summary>
                    <form action={blockPartnerAction} className="space-y-2 border-t border-kv-line p-3">
                      <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                      <input type="hidden" name="partnerId" value={selectedPartner.id} />
                      <textarea name="reason" placeholder="Причина, опционально" className="min-h-[70px] w-full rounded border border-kv-line px-2 py-2 text-[12px] text-kv-ink" />
                      <button className="rounded-full bg-kv-red px-4 py-2 text-[12px] font-black text-white">Заблокировать</button>
                    </form>
                  </details>
                )
              ) : null}
              <div className="space-y-2">
                {blockedPartners.map((item) => (
                  <form key={item.id} action={unblockPartnerAction} className="rounded-md border border-kv-line bg-kv-bg p-3">
                    <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                    <input type="hidden" name="partnerId" value={item.partner.id} />
                    <div className="text-[12px] font-black text-kv-navy">{item.partner.legalName}</div>
                    {item.reason ? <div className="mt-1 text-[12px] text-kv-muted">{item.reason}</div> : null}
                    <button className="mt-2 text-[12px] font-bold text-kv-red">Разблокировать</button>
                  </form>
                ))}
                {!blockedPartners.length ? <div className="text-[12px] text-kv-muted">Список пуст.</div> : null}
              </div>
            </div>
          </div>
        </aside>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_440px]">
          <section className="rounded-md border border-kv-line bg-white">
            <div className="border-b border-kv-line px-5 py-4">
              <h2 className="text-xl font-black text-kv-navy">{selectedPartner?.legalName ?? "Партнёр не выбран"}</h2>
              <p className="mt-1 text-[13px] text-kv-muted">Опубликованные объекты партнёра из общего пула.</p>
            </div>
            <div className="divide-y divide-kv-line">
              {partnerObjects.map((object) => (
                <article key={object.id} className="grid gap-4 p-4 md:grid-cols-[140px_1fr]">
                  <div className="h-[110px] overflow-hidden rounded-md border border-kv-line bg-kv-bg">
                    {resolveMediaUrl(object.media[0]?.url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveMediaUrl(object.media[0]?.url) ?? ""} alt={object.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center px-3 text-center text-[12px] font-bold text-kv-muted">Нет фото</div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-kv-navy">{object.title}</h3>
                    <div className="mt-1 text-[13px] text-kv-muted">{object.addressDisplay ?? `${object.market.city}, ${object.market.country}`}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>{object.assetClass}</Badge>
                      <Badge>{object.priceDisplay ?? (object.priceAmount ? `${object.priceAmount} ${object.priceCurrency ?? ""}` : "Цена по запросу")}</Badge>
                    </div>
                    {selectedPartner?.primaryOffice && blockedPartnerIds.has(selectedPartner.id) ? (
                      <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-bold text-red-700">
                        Партнёр заблокирован вашей организацией. Новый запрос недоступен до разблокировки.
                      </div>
                    ) : null}
                    {selectedPartner?.primaryOffice && !blockedPartnerIds.has(selectedPartner.id) ? (
                      <details className="mt-4 rounded-md border border-kv-line bg-kv-bg">
                        <summary className="cursor-pointer px-4 py-3 text-[13px] font-black text-kv-navy">Создать запрос</summary>
                        <form action={createInteractionAction} className="grid gap-3 border-t border-kv-line p-4 md:grid-cols-2">
                          <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                          <input type="hidden" name="partnerId" value={selectedPartner.id} />
                          <input type="hidden" name="partnerOfferId" value={object.partnerOfferId} />
                          <label className="text-[13px] font-bold text-kv-muted md:col-span-2">
                            Заявка покупателя
                            <select name="clientIntentId" required defaultValue="" className="mt-1 h-10 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink">
                              <option value="" disabled>Выберите заявку, для которой запрашивается объект</option>
                              {clientIntents.map((intent) => (
                                <option key={intent.id} value={intent.id}>
                                  {intent.requirementText.slice(0, 120)}{intent.market ? ` — ${intent.market.city}` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-[13px] font-bold text-kv-muted">
                            Тип
                            <select name="type" defaultValue={selectedTemplate?.type ?? "info_request"} className="mt-1 h-10 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink">
                              <option value="info_request">Информационный запрос</option>
                              <option value="commercial">Коммерческий запрос</option>
                              <option value="cooperation">Кооперация</option>
                            </select>
                          </label>
                          <label className="text-[13px] font-bold text-kv-muted">
                            Срочность
                            <select name="priority" defaultValue="normal" className="mt-1 h-10 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink">
                              <option value="normal">Обычная</option>
                              <option value="urgent">Срочная</option>
                              <option value="critical">Очень срочная</option>
                            </select>
                          </label>
                          <label className="text-[13px] font-bold text-kv-muted">
                            Язык
                            <select name="conversationLanguage" defaultValue={context?.organization.defaultLanguage ?? "ru"} className="mt-1 h-10 w-full rounded-md border border-kv-line bg-white px-3 text-kv-ink">
                              {languageOptions.map((language) => (
                                <option key={language} value={language}>{language.toUpperCase()}</option>
                              ))}
                            </select>
                          </label>
                          <label className="text-[13px] font-bold text-kv-muted">
                            Тема
                            <input name="subject" defaultValue={`Запрос по объекту: ${object.title}`} className="mt-1 h-10 w-full rounded-md border border-kv-line px-3 text-kv-ink" />
                          </label>
                          <label className="text-[13px] font-bold text-kv-muted md:col-span-2">
                            Сообщение
                            <textarea name="message" required defaultValue={selectedTemplate?.text ?? ""} className="mt-1 min-h-[96px] w-full rounded-md border border-kv-line px-3 py-2 text-kv-ink" placeholder="Опишите интерес клиента и что нужно уточнить." />
                          </label>
                          <button disabled={!clientIntents.length} className="rounded-full bg-kv-red px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50 md:col-span-2">Отправить запрос представителю объекта</button>
                          {!clientIntents.length ? <p className="text-[12px] font-bold text-amber-700 md:col-span-2">Сначала создайте заявку покупателя. Запрос всегда связывается с конкретной заявкой и конкретным предложением агентства.</p> : null}
                        </form>
                      </details>
                    ) : null}
                  </div>
                </article>
              ))}
              {!partnerObjects.length ? <div className="p-5 text-kv-muted">У выбранного партнёра нет опубликованных объектов в общем пуле.</div> : null}
            </div>
          </section>

          <section className="rounded-md border border-kv-line bg-white">
            {selectedInteraction ? (
              <>
                <div className="border-b border-kv-line px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="dark">{statusLabel(selectedInteraction.status)}</Badge>
                    <Badge>{typeLabel(selectedInteraction.type)}</Badge>
                    <Badge tone={selectedInteraction.priority === "normal" ? "neutral" : "warn"}>{priorityLabel(selectedInteraction.priority)}</Badge>
                    {selectedInteraction.dealRoomId ? <Badge tone="good">Deal room открыт</Badge> : null}
                  </div>
                  <h2 className="mt-3 text-lg font-black text-kv-navy">{selectedInteraction.subject || selectedInteraction.object.title}</h2>
                  <p className="mt-1 text-[13px] text-kv-muted">{selectedInteraction.initiatingPartner.organizationName} ↔ {selectedInteraction.targetPartner.organizationName}</p>
                  <div className="mt-4">
                    <form action={exportInteractionPdfAction} className="mb-3 flex justify-end">
                      <input type="hidden" name="interactionId" value={selectedInteraction.id} />
                      <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                      <input type="hidden" name="language" value={selectedInteraction.conversationLanguage} />
                      <button className="rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-navy">Экспорт PDF</button>
                    </form>
                    {selectedInteraction.dealRoomId ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-700">
                        Deal room ID: {selectedInteraction.dealRoomId}
                      </div>
                    ) : (
                      <details className="rounded-md border border-kv-line bg-kv-bg">
                        <summary className="cursor-pointer px-3 py-2 text-[12px] font-black text-kv-navy">Открыть deal room</summary>
                        <form action={openDealRoomAction} className="space-y-2 border-t border-kv-line p-3">
                          <input type="hidden" name="interactionId" value={selectedInteraction.id} />
                          <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                          <textarea name="note" placeholder="Опциональная заметка для deal room" className="min-h-[70px] w-full rounded border border-kv-line px-2 py-2 text-[12px] text-kv-ink" />
                          <button className="rounded-full bg-kv-red px-4 py-2 text-[12px] font-black text-white">Создать deal room</button>
                        </form>
                      </details>
                    )}
                  </div>
                </div>

                <div className="max-h-[520px] space-y-3 overflow-auto bg-kv-bg p-4">
                  {selectedInteraction.messages.map((message) => (
                    <div key={message.id} className={`rounded-md border border-kv-line p-3 ${message.sender.ownOrganization ? "ml-8 bg-white" : "mr-8 bg-white"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[12px] font-black text-kv-navy">{message.sender.organizationName}</div>
                        <div className="text-[11px] text-kv-muted">{new Date(message.createdAt).toLocaleString("ru-RU")}</div>
                      </div>
                      {message.deleted ? (
                        <p className="mt-2 rounded-md bg-kv-bg px-3 py-2 text-[13px] font-bold text-kv-muted">Сообщение удалено.</p>
                      ) : (
                        <>
                          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-5 text-kv-ink">{message.originalText}</p>
                          {message.translatedText ? (
                            <div className="mt-2 rounded-md bg-kv-bg px-3 py-2">
                              <div className="text-[11px] font-black uppercase tracking-[0.12em] text-kv-muted">
                                {message.translatedLanguage?.toUpperCase()} · {message.translationStatus === "edited" ? "отредактировано" : "перевод"}
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-kv-muted">{message.translatedText}</p>
                            </div>
                          ) : (
                            <div className="mt-2 text-[11px] font-bold text-kv-muted">Перевод: {message.translationStatus}</div>
                          )}
                          {message.originalLanguage !== selectedInteraction.conversationLanguage || message.translationStatus === "failed" ? (
                            <form action={translateMessageAction} className="mt-2 flex flex-wrap items-center gap-2">
                              <input type="hidden" name="interactionId" value={selectedInteraction.id} />
                              <input type="hidden" name="messageId" value={message.id} />
                              <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                              <select name="targetLanguage" defaultValue={message.translatedLanguage ?? selectedInteraction.conversationLanguage} className="h-8 rounded border border-kv-line bg-white px-2 text-[12px] text-kv-ink">
                                {languageOptions.map((language) => (
                                  <option key={language} value={language}>{language.toUpperCase()}</option>
                                ))}
                              </select>
                              <button className="rounded-full border border-kv-line bg-white px-3 py-1.5 text-[12px] font-black text-kv-navy">Перевести</button>
                            </form>
                          ) : null}
                          <details className="mt-2 rounded-md border border-kv-line bg-white">
                            <summary className="cursor-pointer px-3 py-2 text-[12px] font-black text-kv-navy">Редактировать перевод</summary>
                            <form action={editMessageTranslationAction} className="space-y-2 border-t border-kv-line p-3">
                              <input type="hidden" name="interactionId" value={selectedInteraction.id} />
                              <input type="hidden" name="messageId" value={message.id} />
                              <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                              <select name="translatedLanguage" defaultValue={message.translatedLanguage ?? selectedInteraction.conversationLanguage} className="h-8 w-full rounded border border-kv-line bg-white px-2 text-[12px] text-kv-ink">
                                {languageOptions.map((language) => (
                                  <option key={language} value={language}>{language.toUpperCase()}</option>
                                ))}
                              </select>
                              <textarea
                                name="translatedText"
                                required
                                maxLength={5000}
                                defaultValue={message.translatedText ?? ""}
                                className="min-h-[70px] w-full rounded border border-kv-line px-2 py-2 text-[12px] text-kv-ink"
                              />
                              <button className="rounded-full bg-kv-navy px-3 py-1.5 text-[12px] font-black text-white">Сохранить перевод</button>
                            </form>
                          </details>
                          <div className="mt-2 text-[11px] text-kv-muted">{message.deliveryStatus}{message.readAt ? ` · прочитано ${new Date(message.readAt).toLocaleString("ru-RU")}` : ""}</div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                <form action={sendMessageAction} className="border-t border-kv-line p-4">
                  <input type="hidden" name="interactionId" value={selectedInteraction.id} />
                  <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                  <input type="hidden" name="conversationLanguage" value={selectedInteraction.conversationLanguage} />
                  <label className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">
                    Язык сообщения
                    <select name="originalLanguage" defaultValue={selectedInteraction.conversationLanguage} className="mt-2 h-9 w-full rounded-md border border-kv-line bg-white px-3 text-[13px] text-kv-ink">
                      {languageOptions.map((language) => (
                        <option key={language} value={language}>{language.toUpperCase()}</option>
                      ))}
                    </select>
                  </label>
                  <InteractionMessageComposer interactionId={selectedInteraction.id} officeSlug={activeOfficeSlug} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="rounded-full bg-kv-navy px-5 py-3 text-sm font-black text-white">Отправить</button>
                  </div>
                </form>

                <div className="border-t border-kv-line p-4">
                  <InteractionAttachmentUploadForm interactionId={selectedInteraction.id} officeSlug={activeOfficeSlug} />
                  {selectedInteraction.attachments?.length ? (
                    <div className="mt-3 space-y-2">
                      {selectedInteraction.attachments.filter((attachment) => !attachment.deleted).map((attachment) => {
                        const content = (
                          <>
                            <span className="font-bold text-kv-navy">{attachment.originalFileName}</span>
                            <span className="text-kv-muted">{(Number(attachment.sizeBytes) / 1024 / 1024).toFixed(1)} MB · {attachmentScanStatusLabel(attachment.scanStatus)}</span>
                          </>
                        );

                        return attachment.scanStatus === "clean" ? (
                          <a
                            key={attachment.id}
                            href={`/api/v1/admin/interactions/attachments/${encodeURIComponent(attachment.id)}`}
                            target="_blank"
                            className="flex items-center justify-between gap-3 rounded-md border border-kv-line bg-white px-3 py-2 text-[13px]"
                          >
                            {content}
                          </a>
                        ) : (
                          <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-md border border-kv-line bg-kv-bg px-3 py-2 text-[13px]">
                            {content}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <form action={updateStatusAction} className="border-t border-kv-line p-4">
                  <input type="hidden" name="interactionId" value={selectedInteraction.id} />
                  <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                  <div className="flex flex-wrap gap-2">
                    {["waiting_response", "accepted", "declined", "in_deal", "completed", "archived"].map((status) => (
                      <button key={status} name="status" value={status} className="rounded-full border border-kv-line bg-white px-4 py-2 text-[12px] font-black text-kv-navy">
                        {statusLabel(status)}
                      </button>
                    ))}
                  </div>
                </form>

                <div className="space-y-3 border-t border-kv-line p-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedInteraction.remindedAt ? <Badge tone="warn">Напоминание: {new Date(selectedInteraction.remindedAt).toLocaleString("ru-RU")}</Badge> : null}
                    {selectedInteraction.escalatedAt ? <Badge tone="danger">Эскалация: {new Date(selectedInteraction.escalatedAt).toLocaleString("ru-RU")}</Badge> : null}
                  </div>
                  <details className="rounded-md border border-kv-line bg-kv-bg">
                    <summary className="cursor-pointer px-3 py-2 text-[12px] font-black text-kv-navy">Отправить напоминание</summary>
                    <form action={sendReminderAction} className="space-y-2 border-t border-kv-line p-3">
                      <input type="hidden" name="interactionId" value={selectedInteraction.id} />
                      <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                      <textarea
                        name="message"
                        placeholder="Опциональный текст напоминания"
                        className="min-h-[70px] w-full rounded border border-kv-line px-2 py-2 text-[12px] text-kv-ink"
                      />
                      <button className="rounded-full bg-amber-600 px-4 py-2 text-[12px] font-black text-white">Отправить напоминание</button>
                    </form>
                  </details>
                  <details className="rounded-md border border-red-200 bg-red-50">
                    <summary className="cursor-pointer px-3 py-2 text-[12px] font-black text-red-700">Эскалировать в поддержку платформы</summary>
                    <form action={escalateInteractionAction} className="space-y-2 border-t border-red-200 p-3">
                      <input type="hidden" name="interactionId" value={selectedInteraction.id} />
                      <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                      <textarea
                        name="reason"
                        placeholder="Причина эскалации"
                        className="min-h-[70px] w-full rounded border border-red-200 px-2 py-2 text-[12px] text-kv-ink"
                      />
                      <button className="rounded-full bg-kv-red px-4 py-2 text-[12px] font-black text-white">Эскалировать</button>
                    </form>
                  </details>
                </div>

                <div className="space-y-3 border-t border-kv-line p-4">
                  <div>
                    <div className="text-[12px] font-black uppercase tracking-[0.12em] text-kv-muted">Отзывы</div>
                    <div className="mt-2 space-y-2">
                      {selectedInteraction.reviews?.map((review) => (
                        <div key={review.id} className="rounded-md border border-kv-line bg-kv-bg p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="good">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</Badge>
                            <span className="text-[12px] font-bold text-kv-muted">
                              {review.reviewer.organizationName} → {review.reviewed.organizationName}
                            </span>
                          </div>
                          {review.text ? <p className="mt-2 text-[13px] leading-5 text-kv-ink">{review.text}</p> : null}
                        </div>
                      ))}
                      {!selectedInteraction.reviews?.length ? <div className="text-[12px] text-kv-muted">Отзывов пока нет.</div> : null}
                    </div>
                  </div>

                  {selectedInteraction.status === "completed" ? (
                    <details className="rounded-md border border-kv-line bg-kv-bg">
                      <summary className="cursor-pointer px-3 py-2 text-[12px] font-black text-kv-navy">Оставить отзыв</summary>
                      <form action={submitReviewAction} className="grid gap-2 border-t border-kv-line p-3">
                        <input type="hidden" name="interactionId" value={selectedInteraction.id} />
                        <input type="hidden" name="officeSlug" value={activeOfficeSlug} />
                        <label className="text-[12px] font-bold text-kv-muted">
                          Оценка
                          <select name="rating" defaultValue="5" className="mt-1 h-9 w-full rounded border border-kv-line bg-white px-2 text-[12px] text-kv-ink">
                            <option value="5">5 — отлично</option>
                            <option value="4">4 — хорошо</option>
                            <option value="3">3 — нормально</option>
                            <option value="2">2 — плохо</option>
                            <option value="1">1 — критично</option>
                          </select>
                        </label>
                        <label className="text-[12px] font-bold text-kv-muted">
                          Комментарий
                          <textarea name="text" maxLength={500} className="mt-1 min-h-[70px] w-full rounded border border-kv-line px-2 py-2 text-[12px] text-kv-ink" />
                        </label>
                        <button className="rounded-full bg-kv-navy px-4 py-2 text-[12px] font-black text-white">Сохранить отзыв</button>
                      </form>
                    </details>
                  ) : (
                    <div className="text-[12px] font-bold text-kv-muted">Отзыв можно оставить после завершения взаимодействия.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-5 text-kv-muted">Выберите взаимодействие из истории или создайте новый запрос по объекту.</div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
