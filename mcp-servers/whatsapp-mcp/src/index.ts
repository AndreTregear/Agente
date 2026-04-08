#!/usr/bin/env node
/**
 * WhatsApp Outbound MCP Server
 * Enables agents to send proactive WhatsApp messages via OpenClaw gateway.
 */

import { createMCPServer, formatJSON } from '@yaya/mcp-base';
import { createHttpClient } from '@yaya/http-client';
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ── Configuration ────────────────────────────────────

const OPENCLAW_GATEWAY_URL =
  process.env.OPENCLAW_GATEWAY_URL || "http://localhost:3284";
const WHATSAPP_ACCOUNT = process.env.WHATSAPP_ACCOUNT || "default";
const REQUEST_TIMEOUT_MS = 15_000;

// ── Gateway HTTP Client ─────────────────────────────

const gateway = createHttpClient({
  baseUrl: OPENCLAW_GATEWAY_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

// ── CLI Fallback ─────────────────────────────────────

interface GatewayResponse {
  success: boolean;
  data?: any;
  error?: string;
}

async function sendViaCli(
  phone: string,
  message: string
): Promise<GatewayResponse> {
  try {
    const { stdout, stderr } = await execFileAsync("openclaw", [
      "send",
      "--channel",
      "whatsapp",
      "--to",
      phone,
      "--message",
      message,
    ], { timeout: REQUEST_TIMEOUT_MS });
    return {
      success: true,
      data: { output: stdout.trim(), stderr: stderr.trim() || undefined },
    };
  } catch (err: any) {
    throw new Error(`OpenClaw CLI failed: ${err.message}`);
  }
}

// ── Phone Number Validation ──────────────────────────

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (!cleaned.startsWith("+") && /^\d{10,15}$/.test(cleaned)) {
    cleaned = `+${cleaned}`;
  }
  if (!/^\+\d{10,15}$/.test(cleaned)) {
    throw new Error(
      `Invalid phone number "${phone}". Use E.164 format (e.g., +51999888777).`
    );
  }
  return cleaned;
}

// ── Types ────────────────────────────────────────────

interface TemplateVars {
  [key: string]: string;
}

interface MessageResult {
  success: boolean;
  message_id?: string;
  phone: string;
  timestamp: string;
  error?: string;
}

// ── Built-in Templates ───────────────────────────────

function renderTemplate(
  templateName: string,
  vars: TemplateVars,
  language: string = "es"
): string {
  const templates: Record<string, Record<string, string>> = {
    appointment_reminder: {
      es: `Hola ${vars.customer_name || ""},\n\nLe recordamos su cita el ${vars.date || ""} a las ${vars.time || ""}${vars.service ? ` para ${vars.service}` : ""}${vars.location ? ` en ${vars.location}` : ""}.\n\nPara confirmar, responda "OK". Para reprogramar, responda "CAMBIAR".\n\nGracias.`,
      en: `Hi ${vars.customer_name || ""},\n\nThis is a reminder of your appointment on ${vars.date || ""} at ${vars.time || ""}${vars.service ? ` for ${vars.service}` : ""}${vars.location ? ` at ${vars.location}` : ""}.\n\nReply "OK" to confirm or "RESCHEDULE" to change.\n\nThank you.`,
    },
    payment_reminder: {
      es: `Hola ${vars.customer_name || ""},\n\nLe recordamos que tiene un pago pendiente de S/${vars.amount || "0.00"} por el pedido ${vars.order_id || ""}.\n\nPuede pagar por:\n• Yape/Plin al ${vars.payment_phone || ""}\n• Transferencia bancaria\n\nSi ya realizó el pago, envíenos el comprobante.\n\nGracias.`,
      en: `Hi ${vars.customer_name || ""},\n\nThis is a reminder that you have a pending payment of $${vars.amount || "0.00"} for order ${vars.order_id || ""}.\n\nIf you've already paid, please send us the receipt.\n\nThank you.`,
    },
    order_confirmation: {
      es: `¡Pedido confirmado! 🎉\n\nPedido: ${vars.order_id || ""}\nTotal: S/${vars.amount || "0.00"}\n${vars.items ? `Artículos: ${vars.items}` : ""}\n${vars.delivery_date ? `Entrega estimada: ${vars.delivery_date}` : ""}\n\nGracias por su compra, ${vars.customer_name || ""}.`,
      en: `Order confirmed! 🎉\n\nOrder: ${vars.order_id || ""}\nTotal: $${vars.amount || "0.00"}\n${vars.items ? `Items: ${vars.items}` : ""}\n${vars.delivery_date ? `Estimated delivery: ${vars.delivery_date}` : ""}\n\nThank you for your purchase, ${vars.customer_name || ""}.`,
    },
    shipping_update: {
      es: `Actualización de envío 📦\n\nPedido: ${vars.order_id || ""}\nEstado: ${vars.status || ""}\n${vars.tracking_number ? `Seguimiento: ${vars.tracking_number}` : ""}\n${vars.carrier ? `Transportista: ${vars.carrier}` : ""}\n\n${vars.customer_name || ""}, le avisaremos cuando llegue.`,
      en: `Shipping update 📦\n\nOrder: ${vars.order_id || ""}\nStatus: ${vars.status || ""}\n${vars.tracking_number ? `Tracking: ${vars.tracking_number}` : ""}\n${vars.carrier ? `Carrier: ${vars.carrier}` : ""}\n\n${vars.customer_name || ""}, we'll notify you on delivery.`,
    },
    welcome: {
      es: `¡Bienvenido/a ${vars.customer_name || ""}! 👋\n\nGracias por contactarnos. Estamos aquí para ayudarle.\n\n¿En qué podemos servirle hoy?`,
      en: `Welcome ${vars.customer_name || ""}! 👋\n\nThank you for reaching out. We're here to help.\n\nHow can we assist you today?`,
    },
  };

  if (templateName === "custom") {
    return vars.message || vars.text || "";
  }

  const template = templates[templateName];
  if (!template) {
    throw new Error(
      `Unknown template "${templateName}". Available: ${Object.keys(templates).join(", ")}, custom`
    );
  }

  const msg = template[language] || template["es"];
  if (!msg) {
    throw new Error(`Template "${templateName}" not available in language "${language}".`);
  }
  return msg;
}

// ── Tool Definitions ─────────────────────────────────

const TOOLS = [
  {
    name: "send_message",
    description:
      "Send a text message to a WhatsApp number. The number must be in E.164 format (e.g., +51999888777).",
    inputSchema: {
      type: "object" as const,
      properties: {
        phone_number: {
          type: "string",
          description: "Recipient phone number in E.164 format (e.g., +51999888777)",
        },
        message_text: {
          type: "string",
          description: "Message text to send",
        },
      },
      required: ["phone_number", "message_text"],
    },
  },
  {
    name: "send_media",
    description:
      "Send an image, document, or other media file to a WhatsApp number. Provide a publicly accessible URL for the media.",
    inputSchema: {
      type: "object" as const,
      properties: {
        phone_number: {
          type: "string",
          description: "Recipient phone number in E.164 format",
        },
        media_url: {
          type: "string",
          description: "Publicly accessible URL of the media file (image, PDF, etc.)",
        },
        caption: {
          type: "string",
          description: "Caption for the media (optional)",
        },
        media_type: {
          type: "string",
          enum: ["image", "document", "audio", "video"],
          description: "Type of media (default: auto-detected from URL)",
        },
      },
      required: ["phone_number", "media_url"],
    },
  },
  {
    name: "send_template_message",
    description:
      "Send a pre-formatted template message (appointment reminder, payment reminder, order confirmation). Template variables are filled in dynamically.",
    inputSchema: {
      type: "object" as const,
      properties: {
        phone_number: {
          type: "string",
          description: "Recipient phone number in E.164 format",
        },
        template_name: {
          type: "string",
          enum: [
            "appointment_reminder",
            "payment_reminder",
            "order_confirmation",
            "shipping_update",
            "welcome",
            "custom",
          ],
          description: "Template name",
        },
        template_vars: {
          type: "object",
          description:
            "Key-value pairs for template variables (e.g., {customer_name: 'Juan', amount: '150.00'})",
          additionalProperties: { type: "string" },
        },
        language: {
          type: "string",
          description: "Message language (default: es)",
        },
      },
      required: ["phone_number", "template_name", "template_vars"],
    },
  },
  {
    name: "get_chat_history",
    description:
      "Get recent messages exchanged with a specific WhatsApp contact. Returns both sent and received messages.",
    inputSchema: {
      type: "object" as const,
      properties: {
        phone_number: {
          type: "string",
          description: "Contact phone number in E.164 format",
        },
        limit: {
          type: "number",
          description: "Maximum number of messages to return (default: 20)",
        },
      },
      required: ["phone_number"],
    },
  },
  {
    name: "check_online_status",
    description:
      "Check if the WhatsApp gateway is connected and the linked number is online. Returns connection status and account info.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// ── MCP Server ──────────────────────────────────────

const mcp = createMCPServer({
  name: 'whatsapp-mcp',
  version: '0.1.0',
  tools: TOOLS,
  handler: async (name, args) => {
    switch (name) {
      case "send_message": {
        const phone = normalizePhone(args.phone_number as string);
        const text = args.message_text as string;

        if (!text || text.trim().length === 0) {
          throw new Error("message_text cannot be empty.");
        }

        let result: MessageResult;

        try {
          const res = await gateway.post<any>(
            `/api/sessions/${WHATSAPP_ACCOUNT}/send`,
            {
              to: phone,
              type: "text",
              text: { body: text },
            }
          );

          result = {
            success: true,
            message_id: res?.id || res?.message_id,
            phone,
            timestamp: new Date().toISOString(),
          };
        } catch (gatewayErr: any) {
          try {
            const cliRes = await sendViaCli(phone, text);
            result = {
              success: true,
              phone,
              timestamp: new Date().toISOString(),
              message_id: cliRes.data?.output,
            };
          } catch (cliErr: any) {
            throw new Error(
              `Gateway failed: ${gatewayErr.message}. CLI fallback also failed: ${cliErr.message}`
            );
          }
        }

        return formatJSON(result);
      }

      case "send_media": {
        const phone = normalizePhone(args.phone_number as string);
        const mediaUrl = args.media_url as string;

        if (!mediaUrl) {
          throw new Error("media_url is required.");
        }

        let mediaType = args.media_type as string | undefined;
        if (!mediaType) {
          const ext = mediaUrl.split("?")[0].split(".").pop()?.toLowerCase();
          if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
            mediaType = "image";
          } else if (["mp4", "mov", "avi"].includes(ext || "")) {
            mediaType = "video";
          } else if (["mp3", "ogg", "wav"].includes(ext || "")) {
            mediaType = "audio";
          } else {
            mediaType = "document";
          }
        }

        const payload: Record<string, any> = {
          to: phone,
          type: mediaType,
        };
        payload[mediaType] = {
          url: mediaUrl,
          ...(args.caption ? { caption: args.caption } : {}),
        };

        const res = await gateway.post<any>(
          `/api/sessions/${WHATSAPP_ACCOUNT}/send`,
          payload
        );

        const result: MessageResult = {
          success: true,
          message_id: res?.id || res?.message_id,
          phone,
          timestamp: new Date().toISOString(),
        };

        return formatJSON(result);
      }

      case "send_template_message": {
        const phone = normalizePhone(args.phone_number as string);
        const vars: TemplateVars = (args.template_vars as TemplateVars) || {};
        const language = (args.language as string) || "es";

        const messageText = renderTemplate(
          args.template_name as string,
          vars,
          language
        );

        if (!messageText) {
          throw new Error("Template rendered to empty message.");
        }

        let result: MessageResult;

        try {
          const res = await gateway.post<any>(
            `/api/sessions/${WHATSAPP_ACCOUNT}/send`,
            {
              to: phone,
              type: "text",
              text: { body: messageText },
              metadata: {
                template: args.template_name,
                template_vars: vars,
              },
            }
          );

          result = {
            success: true,
            message_id: res?.id || res?.message_id,
            phone,
            timestamp: new Date().toISOString(),
          };
        } catch (gatewayErr: any) {
          try {
            const cliRes = await sendViaCli(phone, messageText);
            result = {
              success: true,
              phone,
              timestamp: new Date().toISOString(),
              message_id: cliRes.data?.output,
            };
          } catch (cliErr: any) {
            throw new Error(
              `Gateway failed: ${gatewayErr.message}. CLI fallback also failed: ${cliErr.message}`
            );
          }
        }

        return formatJSON({
          ...result,
          template: args.template_name,
          rendered_message: messageText,
        });
      }

      case "get_chat_history": {
        const phone = normalizePhone(args.phone_number as string);
        const limit = args.limit || 20;

        const res = await gateway.get<any>(
          `/api/sessions/${WHATSAPP_ACCOUNT}/chats/${encodeURIComponent(phone)}/messages?limit=${limit}`
        );

        const messages = res?.messages || res || [];

        return formatJSON({
          phone,
          message_count: messages.length,
          messages,
        });
      }

      case "check_online_status": {
        const start = Date.now();
        const result: Record<string, any> = {
          gateway_url: OPENCLAW_GATEWAY_URL,
          account: WHATSAPP_ACCOUNT,
        };

        try {
          const res = await gateway.get<any>(
            `/api/sessions/${WHATSAPP_ACCOUNT}/status`
          );

          result.latency_ms = Date.now() - start;
          result.gateway_reachable = true;
          result.session_status = res?.status || "unknown";
          result.connected = res?.status === "connected" ||
                             res?.status === "CONNECTED" ||
                             res?.connected === true;
          result.phone_number = res?.phone || res?.me?.id || null;
          result.name = res?.name || res?.pushName || null;
        } catch (err: any) {
          result.latency_ms = Date.now() - start;
          result.gateway_reachable = false;
          result.connected = false;
          result.error = err.message;
        }

        return formatJSON(result);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
});

mcp.start();
