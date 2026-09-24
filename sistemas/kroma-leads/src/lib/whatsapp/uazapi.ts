import "server-only";
/**
 * Adaptador da Uazapi (API não oficial do WhatsApp). TODO o contato com a
 * Uazapi passa por aqui — pra trocar de provedor, basta reimplementar
 * `WhatsAppProvider` e trocar `createProvider`.
 *
 * Endpoints conferidos na doc oficial (docs.uazapi.com, API 2.4.0):
 *   GET  /instance/status     → status + QR atualizado
 *   POST /instance/connect    → inicia conexão (sem `phone` devolve QR)
 *   POST /instance/disconnect
 *   POST /send/text           → { number, text, delay } — `delay` mostra "Digitando…"
 *   POST /message/presence    → { number, presence: "composing", delay }
 *   POST /webhook             → modo simples { url, events, excludeMessages, enabled }
 * Autenticação: header `token` com o token da instância.
 */

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface InstanceInfo {
  status: ConnectionStatus;
  qrCode: string | null;
  phone: string | null;
  profileName: string | null;
  lastDisconnectReason: string | null;
}

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
  /** o WhatsApp restringiu a conta (ex.: erro 463, ban temporário) */
  restricted?: boolean;
  /** token inválido / instância inexistente: não adianta tentar de novo */
  fatal?: boolean;
}

export interface WhatsAppProvider {
  status(): Promise<InstanceInfo>;
  connect(): Promise<InstanceInfo>;
  disconnect(): Promise<void>;
  sendText(toDigits: string, text: string, typingMs: number): Promise<SendResult>;
  setWebhook(url: string): Promise<void>;
}

export class ProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

interface UazapiErrorBody {
  error?: string;
  message_ptbr?: string;
  provider_message_ptbr?: string;
  provider_code?: number;
  error_key?: string;
}

class UazapiProvider implements WhatsAppProvider {
  private base: string;

  constructor(serverUrl: string, private token: string) {
    this.base = normalizeServerUrl(serverUrl);
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown, timeoutMs = 25000): Promise<{ status: number; data: T }> {
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        method,
        headers: { token: this.token, "Content-Type": "application/json", Accept: "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (e) {
      const msg = e instanceof Error && e.name === "TimeoutError" ? "O servidor da Uazapi demorou demais pra responder." : "Não consegui falar com o servidor da Uazapi. Confira a URL.";
      throw new ProviderError(msg);
    }
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text.slice(0, 200) };
    }
    return { status: res.status, data: data as T };
  }

  private explain(status: number, body: UazapiErrorBody): string {
    if (status === 401) return "Token da instância inválido ou expirado.";
    if (status === 404) return "Instância não encontrada nesse servidor.";
    if (status === 429) return "Limite de requisições da Uazapi atingido. Tente de novo em instantes.";
    return body.provider_message_ptbr || body.message_ptbr || body.error || `Erro ${status} na Uazapi.`;
  }

  private parseInstance(data: Record<string, unknown>): InstanceInfo {
    const inst = (data.instance ?? data) as Record<string, unknown>;
    const st = (data.status ?? {}) as Record<string, unknown>;
    const raw = String(inst.status ?? "");
    let status: ConnectionStatus = "disconnected";
    if (raw === "connected" || (st.connected === true && st.loggedIn === true)) status = "connected";
    else if (raw === "connecting") status = "connecting";
    const jid = st.jid as { user?: string } | null | undefined;
    const qr = typeof inst.qrcode === "string" && inst.qrcode ? inst.qrcode : null;
    return {
      status,
      qrCode: status === "connecting" ? (qr && !qr.startsWith("data:") ? `data:image/png;base64,${qr}` : qr) : null,
      phone: jid?.user ? `+${String(jid.user).split(":")[0]}` : (typeof inst.owner === "string" && /^\d{8,}$/.test(inst.owner) ? `+${inst.owner}` : null),
      profileName: typeof inst.profileName === "string" ? inst.profileName : null,
      lastDisconnectReason: typeof inst.lastDisconnectReason === "string" ? inst.lastDisconnectReason : null,
    };
  }

  async status(): Promise<InstanceInfo> {
    const { status, data } = await this.call<Record<string, unknown>>("GET", "/instance/status");
    if (status >= 400) throw new ProviderError(this.explain(status, data as UazapiErrorBody), status);
    return this.parseInstance(data);
  }

  async connect(): Promise<InstanceInfo> {
    const { status, data } = await this.call<Record<string, unknown>>("POST", "/instance/connect", {});
    // 409 = já existe um fluxo de conexão em andamento → só consulta o status
    if (status === 409) return this.status();
    if (status >= 400) throw new ProviderError(this.explain(status, data as UazapiErrorBody), status);
    const info = this.parseInstance(data);
    if (info.status === "connecting" && !info.qrCode) return this.status();
    return info;
  }

  async disconnect(): Promise<void> {
    const { status, data } = await this.call<UazapiErrorBody>("POST", "/instance/disconnect", {});
    if (status >= 400 && status !== 404) throw new ProviderError(this.explain(status, data), status);
  }

  async sendText(toDigits: string, text: string, typingMs: number): Promise<SendResult> {
    const { status, data } = await this.call<Record<string, unknown> & UazapiErrorBody>(
      "POST", "/send/text",
      { number: toDigits, text, delay: Math.max(0, Math.round(typingMs)), linkPreview: false, readchat: true },
      typingMs + 30000,
    );
    if (status >= 200 && status < 300 && !data.error) {
      const id = (data.messageid ?? data.id ?? (data.key as { id?: string } | undefined)?.id) as string | undefined;
      return { ok: true, providerMessageId: id };
    }
    const key = String(data.error_key ?? "");
    const restricted =
      data.provider_code === 463 || /TIMELOCK|BAN|RESTRICT|CAPPED/i.test(key) ||
      /restri|banid|bloquead/i.test(String(data.provider_message_ptbr ?? data.error ?? ""));
    return {
      ok: false,
      error: this.explain(status, data),
      restricted,
      fatal: status === 401 || status === 404,
    };
  }

  async setWebhook(url: string): Promise<void> {
    const { status, data } = await this.call<UazapiErrorBody>("POST", "/webhook", {
      enabled: true,
      url,
      events: ["messages", "messages_update", "connection"],
      // evita loop: mensagens que o próprio sistema mandou pela API não voltam
      excludeMessages: ["wasSentByApi", "isGroupYes"],
    });
    if (status >= 400) throw new ProviderError("Não consegui registrar o webhook: " + this.explain(status, data), status);
  }
}

export function normalizeServerUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, "");
}

export function createProvider(serverUrl: string, token: string): WhatsAppProvider {
  return new UazapiProvider(serverUrl, token);
}

// ------------------------------------------------------------------
// Webhook: normalização do payload da Uazapi para o formato interno
// ------------------------------------------------------------------
export type WebhookEvent =
  | {
      type: "message";
      token: string | null;
      providerMessageId: string | null;
      chatJid: string | null;
      senderPn: string | null;
      senderName: string | null;
      fromMe: boolean;
      isGroup: boolean;
      text: string;
      timestamp: Date;
    }
  | { type: "receipt"; token: string | null; messageIds: string[]; state: "delivered" | "read" | null }
  | { type: "connection"; token: string | null; status: ConnectionStatus; reason: string | null; banned: boolean }
  | { type: "ignored"; token: string | null };

export function parseWebhook(body: Record<string, unknown>): WebhookEvent {
  const token = typeof body.token === "string" ? body.token : null;
  const ev = String(body.EventType ?? body.event ?? "").toLowerCase();

  if (ev === "messages") {
    const m = (body.message ?? {}) as Record<string, unknown>;
    const chat = (body.chat ?? {}) as Record<string, unknown>;
    const content = m.content as Record<string, unknown> | string | undefined;
    const text =
      (typeof m.text === "string" && m.text) ||
      (typeof content === "string" ? content : typeof content?.text === "string" ? content.text : "") ||
      (m.messageType ? `[${String(m.messageType)}]` : "");
    const ts = Number(m.messageTimestamp ?? 0);
    const chatJid = (m.chatid ?? chat.wa_chatid ?? null) as string | null;
    return {
      type: "message",
      token,
      providerMessageId: (m.messageid ?? m.id ?? null) as string | null,
      chatJid,
      senderPn: (m.sender_pn ?? (typeof m.sender === "string" && m.sender.includes("@s.whatsapp.net") ? m.sender : null)) as string | null,
      senderName: (m.senderName ?? chat.name ?? null) as string | null,
      fromMe: m.fromMe === true,
      isGroup: m.isGroup === true || (typeof chatJid === "string" && chatJid.endsWith("@g.us")),
      text: String(text),
      timestamp: ts ? new Date(ts > 1e12 ? ts : ts * 1000) : new Date(),
    };
  }

  if (ev === "messages_update") {
    const e = (body.event ?? {}) as Record<string, unknown>;
    const raw = String(body.state ?? e.Type ?? "").toLowerCase();
    const state = raw.includes("read") || raw.includes("played") ? "read" : raw.includes("deliver") ? "delivered" : null;
    const ids = Array.isArray(e.MessageIDs) ? (e.MessageIDs as unknown[]).map(String) : [];
    return { type: "receipt", token, messageIds: ids, state };
  }

  if (ev === "connection") {
    const inst = (body.instance ?? {}) as Record<string, unknown>;
    const raw = String(inst.status ?? "");
    const status: ConnectionStatus = raw === "connected" ? "connected" : raw === "connecting" ? "connecting" : "disconnected";
    const t = String(body.type ?? "");
    return {
      type: "connection",
      token,
      status,
      reason: (inst.lastDisconnectReason as string) ?? (t || null),
      banned: /ban/i.test(t) || body.temporaryBan !== undefined,
    };
  }

  return { type: "ignored", token };
}
