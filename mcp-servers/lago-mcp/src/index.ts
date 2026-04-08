#!/usr/bin/env node
/**
 * Lago Billing MCP Server
 * Exposes Lago REST API as MCP tools for OpenClaw agents.
 */

import { createMCPServer, formatJSON } from '@yaya/mcp-base';
import { createHttpClient } from '@yaya/http-client';

// ── Configuration ────────────────────────────────────

const LAGO_API_URL = process.env.LAGO_API_URL || "http://localhost:3000";
const LAGO_API_KEY = process.env.LAGO_API_KEY || "";

// ── Lago HTTP Client ────────────────────────────────

const lago = createHttpClient({
  baseUrl: `${LAGO_API_URL}/api/v1`,
  auth: LAGO_API_KEY ? { type: 'bearer', token: LAGO_API_KEY } : undefined,
  timeout: 10_000,
});

// ── Types ────────────────────────────────────────────

interface InvoiceItem {
  add_on_code: string;
  units: number;
  unit_amount_cents?: number;
  description?: string;
}

// ── Tool Definitions ─────────────────────────────────

const TOOLS = [
  {
    name: "list_subscriptions",
    description:
      "List active subscriptions for a customer. Returns subscription IDs, plan codes, and status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        external_customer_id: {
          type: "string",
          description: "Customer external ID",
        },
        status: {
          type: "string",
          enum: ["active", "pending", "terminated", "canceled"],
          description: "Filter by status (default: active)",
        },
        page: { type: "number", description: "Page number (default 1)" },
        per_page: { type: "number", description: "Results per page (default 20)" },
      },
      required: ["external_customer_id"],
    },
  },
  {
    name: "get_subscription",
    description: "Get full details for a specific subscription including plan, status, and billing dates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        external_id: {
          type: "string",
          description: "Subscription external ID",
        },
      },
      required: ["external_id"],
    },
  },
  {
    name: "create_subscription",
    description:
      "Subscribe a customer to a plan. Creates a new subscription and starts billing.",
    inputSchema: {
      type: "object" as const,
      properties: {
        external_customer_id: {
          type: "string",
          description: "Customer external ID",
        },
        plan_code: {
          type: "string",
          description: "Code of the plan to subscribe to",
        },
        external_id: {
          type: "string",
          description: "Unique external ID for this subscription (optional, auto-generated if omitted)",
        },
        name: {
          type: "string",
          description: "Display name for the subscription (optional)",
        },
        billing_time: {
          type: "string",
          enum: ["calendar", "anniversary"],
          description: "Billing alignment: calendar (start of month) or anniversary (subscription date). Default: calendar",
        },
      },
      required: ["external_customer_id", "plan_code"],
    },
  },
  {
    name: "cancel_subscription",
    description: "Cancel an active subscription. It will remain active until the end of the current billing period.",
    inputSchema: {
      type: "object" as const,
      properties: {
        external_id: {
          type: "string",
          description: "Subscription external ID to cancel",
        },
      },
      required: ["external_id"],
    },
  },
  {
    name: "list_invoices",
    description:
      "List invoices for a customer. Returns invoice numbers, amounts, status, and dates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        external_customer_id: {
          type: "string",
          description: "Customer external ID",
        },
        status: {
          type: "string",
          enum: ["draft", "finalized", "voided", "pending"],
          description: "Filter by invoice status (optional)",
        },
        page: { type: "number", description: "Page number (default 1)" },
        per_page: { type: "number", description: "Results per page (default 20)" },
      },
      required: ["external_customer_id"],
    },
  },
  {
    name: "create_invoice",
    description:
      "Generate a one-off invoice for a customer with specific add-on charges.",
    inputSchema: {
      type: "object" as const,
      properties: {
        external_customer_id: {
          type: "string",
          description: "Customer external ID",
        },
        currency: {
          type: "string",
          description: "Currency code (e.g., USD, EUR, XOF)",
        },
        fees: {
          type: "array",
          items: {
            type: "object",
            properties: {
              add_on_code: { type: "string", description: "Add-on code to charge" },
              units: { type: "number", description: "Number of units" },
              unit_amount_cents: {
                type: "number",
                description: "Price per unit in cents (optional, uses add-on default if omitted)",
              },
              description: {
                type: "string",
                description: "Line item description (optional)",
              },
            },
            required: ["add_on_code", "units"],
          },
          description: "List of fee items to include on the invoice",
        },
      },
      required: ["external_customer_id", "currency", "fees"],
    },
  },
  {
    name: "get_invoice",
    description:
      "Get full invoice details including line items, amounts, and PDF download link.",
    inputSchema: {
      type: "object" as const,
      properties: {
        lago_id: {
          type: "string",
          description: "Lago invoice ID (UUID)",
        },
      },
      required: ["lago_id"],
    },
  },
  {
    name: "list_plans",
    description:
      "List all available subscription plans with their codes, prices, and billing intervals.",
    inputSchema: {
      type: "object" as const,
      properties: {
        page: { type: "number", description: "Page number (default 1)" },
        per_page: { type: "number", description: "Results per page (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "record_usage",
    description:
      "Record a usage event for metered billing. Used to track consumption-based charges.",
    inputSchema: {
      type: "object" as const,
      properties: {
        transaction_id: {
          type: "string",
          description: "Unique idempotency key for this event",
        },
        external_subscription_id: {
          type: "string",
          description: "Subscription external ID to record usage against",
        },
        code: {
          type: "string",
          description: "Billable metric code",
        },
        timestamp: {
          type: "number",
          description: "Unix timestamp of the event (optional, defaults to now)",
        },
        properties: {
          type: "object",
          description: "Additional properties for the usage event (optional)",
          additionalProperties: true,
        },
      },
      required: ["transaction_id", "external_subscription_id", "code"],
    },
  },
];

// ── MCP Server ──────────────────────────────────────

const mcp = createMCPServer({
  name: 'lago-mcp',
  version: '0.1.0',
  tools: TOOLS,
  handler: async (name, args) => {
    switch (name) {
      case "list_subscriptions": {
        const params = new URLSearchParams();
        params.set("external_customer_id", args.external_customer_id as string);
        if (args.status) params.set("status[]", args.status as string);
        if (args.page) params.set("page", String(args.page));
        if (args.per_page) params.set("per_page", String(args.per_page));
        const data = await lago.get(`/subscriptions?${params.toString()}`);
        return formatJSON(data);
      }

      case "get_subscription": {
        const data = await lago.get(`/subscriptions/${encodeURIComponent(args.external_id as string)}`);
        return formatJSON(data);
      }

      case "create_subscription": {
        const body: Record<string, any> = {
          external_customer_id: args.external_customer_id,
          plan_code: args.plan_code,
        };
        if (args.external_id) body.external_id = args.external_id;
        if (args.name) body.name = args.name;
        if (args.billing_time) body.billing_time = args.billing_time;

        const data = await lago.post("/subscriptions", { subscription: body });
        return formatJSON(data);
      }

      case "cancel_subscription": {
        const data = await lago.delete(`/subscriptions/${encodeURIComponent(args.external_id as string)}`);
        return formatJSON(data);
      }

      case "list_invoices": {
        const params = new URLSearchParams();
        params.set("external_customer_id", args.external_customer_id as string);
        if (args.status) params.set("status", args.status as string);
        if (args.page) params.set("page", String(args.page));
        if (args.per_page) params.set("per_page", String(args.per_page));
        const data = await lago.get(`/invoices?${params.toString()}`);
        return formatJSON(data);
      }

      case "create_invoice": {
        const fees = (args.fees as InvoiceItem[]).map((fee) => ({
          add_on_code: fee.add_on_code,
          units: fee.units,
          ...(fee.unit_amount_cents != null
            ? { unit_amount_cents: fee.unit_amount_cents }
            : {}),
          ...(fee.description ? { description: fee.description } : {}),
        }));

        const data = await lago.post("/invoices", {
          invoice: {
            external_customer_id: args.external_customer_id,
            currency: args.currency,
            fees,
          },
        });
        return formatJSON(data);
      }

      case "get_invoice": {
        const data = await lago.get(`/invoices/${encodeURIComponent(args.lago_id as string)}`);
        return formatJSON(data);
      }

      case "list_plans": {
        const params = new URLSearchParams();
        if (args.page) params.set("page", String(args.page));
        if (args.per_page) params.set("per_page", String(args.per_page));
        const qs = params.toString();
        const data = await lago.get(`/plans${qs ? `?${qs}` : ""}`);
        return formatJSON(data);
      }

      case "record_usage": {
        const event: Record<string, any> = {
          transaction_id: args.transaction_id,
          external_subscription_id: args.external_subscription_id,
          code: args.code,
        };
        if (args.timestamp) event.timestamp = args.timestamp;
        if (args.properties) event.properties = args.properties;

        const data = await lago.post("/events", { event });
        return formatJSON(data);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
});

mcp.start();
