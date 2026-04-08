#!/usr/bin/env node
/**
 * Atomic CRM MCP Server
 * Exposes Supabase-based CRM REST API as MCP tools for OpenClaw agents.
 *
 * Tools:
 *  - search_contacts: Search contacts by name, phone, email
 *  - get_contact: Get full contact details with interaction history
 *  - create_contact: Create a new contact from WhatsApp conversation
 *  - update_contact: Update contact info (phone, email, tags, notes)
 *  - log_interaction: Log a customer interaction
 *  - list_deals: List deals/opportunities in pipeline
 *  - create_deal: Create a new deal/opportunity
 *  - update_deal: Update deal stage, value, notes
 *  - get_segments: Get customer segments
 *  - tag_contact: Add/remove tags from a contact
 */

import { createMCPServer, formatJSON } from '@yaya/mcp-base';
import { createHttpClient } from '@yaya/http-client';

// ── Configuration ────────────────────────────────────

const SUPABASE_URL = process.env.CRM_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.CRM_SUPABASE_KEY || "";

// ── Supabase HTTP Client ────────────────────────────

const crm = createHttpClient({
  baseUrl: `${SUPABASE_URL}/rest/v1`,
  headers: {
    apikey: SUPABASE_KEY,
    Prefer: "return=representation",
  },
  auth: { type: 'bearer', token: SUPABASE_KEY },
  timeout: 10_000,
});

// ── Helper: Supabase query via httpClient ────────────

async function crmGet(table: string, query: string = ""): Promise<any> {
  if (!SUPABASE_URL) throw new Error("CRM_SUPABASE_URL not configured.");
  if (!SUPABASE_KEY) throw new Error("CRM_SUPABASE_KEY not configured.");
  return crm.get(`/${table}${query ? `?${query}` : ""}`);
}

async function crmGetSingle(table: string, query: string): Promise<any> {
  if (!SUPABASE_URL) throw new Error("CRM_SUPABASE_URL not configured.");
  if (!SUPABASE_KEY) throw new Error("CRM_SUPABASE_KEY not configured.");
  return crm.get(`/${table}?${query}`, {
    headers: { Accept: "application/vnd.pgrst.object+json" },
  });
}

async function crmPost(table: string, body: any): Promise<any> {
  if (!SUPABASE_URL) throw new Error("CRM_SUPABASE_URL not configured.");
  if (!SUPABASE_KEY) throw new Error("CRM_SUPABASE_KEY not configured.");
  return crm.post(`/${table}`, body);
}

async function crmPatch(table: string, query: string, body: any): Promise<any> {
  if (!SUPABASE_URL) throw new Error("CRM_SUPABASE_URL not configured.");
  if (!SUPABASE_KEY) throw new Error("CRM_SUPABASE_KEY not configured.");
  return crm.patch(`/${table}?${query}`, body);
}

// ── Startup Validation ──────────────────────────────────

async function validateConnection(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "WARNING: CRM Supabase credentials not configured. Set CRM_SUPABASE_URL and CRM_SUPABASE_KEY."
    );
    return;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: "HEAD",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (res.ok || res.status === 200 || res.status === 204) {
      console.error("CRM: Supabase connection validated");
    } else if (res.status === 401 || res.status === 403) {
      console.error(
        `WARNING: CRM Supabase auth failed (${res.status}). Check CRM_SUPABASE_KEY.`
      );
    } else {
      console.error(`WARNING: CRM Supabase returned ${res.status} on startup check.`);
    }
  } catch (err: any) {
    console.error(`WARNING: Cannot reach CRM Supabase at ${SUPABASE_URL}: ${err.message}`);
  }
}

// ── Types ────────────────────────────────────────────

interface ContactInput {
  first_name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  company?: string;
  tags?: string[];
  notes?: string;
  source?: string;
}

interface InteractionInput {
  contact_id: string;
  type: "call" | "message" | "email" | "purchase" | "complaint" | "visit" | "note";
  summary: string;
  metadata?: Record<string, any>;
}

interface DealInput {
  contact_id: string;
  name: string;
  stage?: string;
  amount?: number;
  currency?: string;
  notes?: string;
  expected_close_date?: string;
}

// ── Tool Definitions ─────────────────────────────────

const TOOLS = [
  {
    name: "search_contacts",
    description:
      "Search CRM contacts by name, phone number, or email. Returns matching contacts with basic info.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search term (matches against name, phone, email)",
        },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_contact",
    description:
      "Get full contact details including tags, notes, and recent interaction history.",
    inputSchema: {
      type: "object" as const,
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "create_contact",
    description:
      "Create a new contact in the CRM, e.g. from a WhatsApp conversation. Returns the created contact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        first_name: { type: "string", description: "First name" },
        last_name: { type: "string", description: "Last name (optional)" },
        phone: { type: "string", description: "Phone number (e.g., +225XXXXXXXXXX)" },
        email: { type: "string", description: "Email address (optional)" },
        company: { type: "string", description: "Company/organization (optional)" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to assign (optional)",
        },
        notes: { type: "string", description: "Initial notes (optional)" },
        source: {
          type: "string",
          description: "Lead source (e.g., whatsapp, website, referral)",
        },
      },
      required: ["first_name"],
    },
  },
  {
    name: "update_contact",
    description: "Update an existing contact's information (phone, email, tags, notes, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        first_name: { type: "string", description: "Updated first name" },
        last_name: { type: "string", description: "Updated last name" },
        phone: { type: "string", description: "Updated phone number" },
        email: { type: "string", description: "Updated email" },
        company: { type: "string", description: "Updated company" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Replace all tags",
        },
        notes: { type: "string", description: "Updated notes" },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "log_interaction",
    description:
      "Log a customer interaction (call, message, purchase, complaint, etc.) against a contact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        type: {
          type: "string",
          enum: ["call", "message", "email", "purchase", "complaint", "visit", "note"],
          description: "Interaction type",
        },
        summary: {
          type: "string",
          description: "Description of the interaction",
        },
        metadata: {
          type: "object",
          description: "Additional structured data (e.g., order_id, amount)",
          additionalProperties: true,
        },
      },
      required: ["contact_id", "type", "summary"],
    },
  },
  {
    name: "list_deals",
    description: "List deals/opportunities in the pipeline, optionally filtered by stage or contact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        contact_id: {
          type: "string",
          description: "Filter by contact UUID (optional)",
        },
        stage: {
          type: "string",
          description: "Filter by pipeline stage (e.g., lead, qualified, proposal, won, lost)",
        },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "create_deal",
    description: "Create a new deal/opportunity in the sales pipeline for a contact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        name: { type: "string", description: "Deal name/title" },
        stage: {
          type: "string",
          description: "Pipeline stage (default: lead)",
        },
        amount: { type: "number", description: "Deal value" },
        currency: { type: "string", description: "Currency code (default: XOF)" },
        notes: { type: "string", description: "Deal notes (optional)" },
        expected_close_date: {
          type: "string",
          description: "Expected close date (ISO format, optional)",
        },
      },
      required: ["contact_id", "name"],
    },
  },
  {
    name: "update_deal",
    description: "Update a deal's stage, value, or notes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        deal_id: { type: "string", description: "Deal UUID" },
        stage: { type: "string", description: "New pipeline stage" },
        amount: { type: "number", description: "Updated deal value" },
        notes: { type: "string", description: "Updated notes" },
        name: { type: "string", description: "Updated deal name" },
      },
      required: ["deal_id"],
    },
  },
  {
    name: "get_segments",
    description:
      "Get customer segments (VIP, new, dormant, at-risk) with contact counts and criteria.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "tag_contact",
    description: "Add or remove tags from a contact.",
    inputSchema: {
      type: "object" as const,
      properties: {
        contact_id: { type: "string", description: "Contact UUID" },
        add: {
          type: "array",
          items: { type: "string" },
          description: "Tags to add",
        },
        remove: {
          type: "array",
          items: { type: "string" },
          description: "Tags to remove",
        },
      },
      required: ["contact_id"],
    },
  },
  {
    name: "health_check",
    description:
      "Check Supabase CRM connection status, auth validity, and response time.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// ── MCP Server ──────────────────────────────────────

const mcp = createMCPServer({
  name: 'crm-mcp',
  version: '0.1.0',
  tools: TOOLS,
  onStartup: validateConnection,
  handler: async (name, args) => {
    switch (name) {
      case "search_contacts": {
        const limit = args.limit || 10;
        const q = encodeURIComponent(args.query as string);
        const query = `or=(first_name.ilike.*${q}*,last_name.ilike.*${q}*,phone.ilike.*${q}*,email.ilike.*${q}*)&limit=${limit}&order=created_at.desc`;
        const data = await crmGet("contacts", query);
        return formatJSON(data);
      }

      case "get_contact": {
        const contact = await crmGetSingle("contacts", `id=eq.${args.contact_id}`);
        const interactions = await crmGet("interactions",
          `contact_id=eq.${args.contact_id}&order=created_at.desc&limit=20`
        );
        return formatJSON({ ...contact, interactions });
      }

      case "create_contact": {
        const contact: Record<string, any> = {
          first_name: args.first_name,
        };
        if (args.last_name) contact.last_name = args.last_name;
        if (args.phone) contact.phone = args.phone;
        if (args.email) contact.email = args.email;
        if (args.company) contact.company = args.company;
        if (args.tags) contact.tags = args.tags;
        if (args.notes) contact.notes = args.notes;
        if (args.source) contact.source = args.source;

        const data = await crmPost("contacts", contact);
        return formatJSON(data);
      }

      case "update_contact": {
        const { contact_id, ...updates } = args;
        if (Object.keys(updates).length === 0) {
          throw new Error("No fields to update. Provide at least one field to change.");
        }
        const data = await crmPatch("contacts", `id=eq.${contact_id}`, updates);
        return formatJSON(data);
      }

      case "log_interaction": {
        const interaction: Record<string, any> = {
          contact_id: args.contact_id,
          type: args.type,
          summary: args.summary,
        };
        if (args.metadata) interaction.metadata = args.metadata;

        const data = await crmPost("interactions", interaction);
        return formatJSON(data);
      }

      case "list_deals": {
        const limit = args.limit || 20;
        const filters: string[] = [`limit=${limit}`, "order=created_at.desc"];
        if (args.contact_id) filters.push(`contact_id=eq.${args.contact_id}`);
        if (args.stage) filters.push(`stage=eq.${args.stage}`);
        const data = await crmGet("deals", filters.join("&"));
        return formatJSON(data);
      }

      case "create_deal": {
        const deal: Record<string, any> = {
          contact_id: args.contact_id,
          name: args.name,
        };
        if (args.stage) deal.stage = args.stage;
        if (args.amount != null) deal.amount = args.amount;
        if (args.currency) deal.currency = args.currency;
        if (args.notes) deal.notes = args.notes;
        if (args.expected_close_date) deal.expected_close_date = args.expected_close_date;

        const data = await crmPost("deals", deal);
        return formatJSON(data);
      }

      case "update_deal": {
        const { deal_id, ...updates } = args;
        if (Object.keys(updates).length === 0) {
          throw new Error("No fields to update. Provide at least one field to change.");
        }
        const data = await crmPatch("deals", `id=eq.${deal_id}`, updates);
        return formatJSON(data);
      }

      case "get_segments": {
        try {
          const data = await crmPost("rpc/get_customer_segments", {});
          return formatJSON(data);
        } catch {
          const data = await crmGet("segments", "order=name.asc");
          return formatJSON(data);
        }
      }

      case "tag_contact": {
        const contact = await crmGetSingle("contacts", `id=eq.${args.contact_id}&select=tags`);
        let tags: string[] = Array.isArray(contact.tags) ? [...contact.tags] : [];

        if (args.add && Array.isArray(args.add)) {
          for (const tag of args.add as string[]) {
            if (!tags.includes(tag)) tags.push(tag);
          }
        }
        if (args.remove && Array.isArray(args.remove)) {
          tags = tags.filter((t) => !(args.remove as string[]).includes(t));
        }

        const data = await crmPatch("contacts", `id=eq.${args.contact_id}`, { tags });
        return formatJSON(data);
      }

      case "health_check": {
        const start = Date.now();
        const result: Record<string, any> = {
          url: SUPABASE_URL,
          auth_configured: !!SUPABASE_KEY,
        };
        try {
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/contacts?limit=1&select=id`,
            {
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
              },
            }
          );
          result.latency_ms = Date.now() - start;
          if (res.ok) {
            result.status = "connected";
            result.tables_accessible = true;
          } else if (res.status === 401 || res.status === 403) {
            result.status = "auth_error";
            result.error = `Auth failed (${res.status}). Check CRM_SUPABASE_KEY.`;
          } else {
            result.status = "error";
            result.error = `Unexpected status ${res.status}`;
          }
        } catch (err: any) {
          result.latency_ms = Date.now() - start;
          result.status = "unreachable";
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
