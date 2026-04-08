#!/usr/bin/env node
/**
 * Forex MCP Server
 * Provides exchange rates, currency conversion, and Peru import cost tools.
 */

import { createMCPServer, formatJSON } from '@yaya/mcp-base';
import { createHttpClient, createResponseCache } from '@yaya/http-client';

const FOREX_API_URL =
  process.env.FOREX_API_URL || "https://open.er-api.com/v6/latest";

const IGV_RATE = 0.18;

// ── Rate cache (5-minute TTL) ────────────────────────

const rateCache = createResponseCache<Record<string, number>>(5 * 60 * 1000);

const forexClient = createHttpClient({
  baseUrl: FOREX_API_URL,
  timeout: 10_000,
});

async function getRates(base: string): Promise<Record<string, number>> {
  const key = base.toUpperCase();

  const cached = rateCache.get(key);
  if (cached) return cached;

  const data = await forexClient.get<{
    result?: string;
    rates?: Record<string, number>;
  }>(`/${key}`);

  if (data.result === "error" || !data.rates) {
    throw new Error(`Forex API returned no rates for ${key}`);
  }

  rateCache.set(key, data.rates);
  return data.rates;
}

async function getRate(from: string, to: string): Promise<number> {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();

  if (fromUpper === toUpper) return 1;

  const rates = await getRates(fromUpper);
  const rate = rates[toUpper];
  if (rate === undefined) {
    throw new Error(`No exchange rate found for ${fromUpper} -> ${toUpper}`);
  }
  return rate;
}

// ── Tool Definitions ─────────────────────────────────

const TOOLS = [
  {
    name: "get_exchange_rate",
    description:
      "Get the current exchange rate between two currencies (e.g., USD/PEN, RMB/PEN, USD/RMB).",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Source currency code (e.g., USD, PEN, CNY)",
        },
        to: {
          type: "string",
          description: "Target currency code (e.g., PEN, USD, CNY)",
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "convert_amount",
    description:
      "Convert an amount from one currency to another at the current exchange rate.",
    inputSchema: {
      type: "object" as const,
      properties: {
        amount: { type: "number", description: "Amount to convert" },
        from: { type: "string", description: "Source currency code" },
        to: { type: "string", description: "Target currency code" },
      },
      required: ["amount", "from", "to"],
    },
  },
  {
    name: "get_rate_history",
    description:
      "Get exchange rate history for a currency pair over a date range. Uses the Frankfurter API for historical data.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "Source currency code" },
        to: { type: "string", description: "Target currency code" },
        start_date: {
          type: "string",
          description: "Start date, ISO format (e.g., 2025-01-01)",
        },
        end_date: {
          type: "string",
          description: "End date, ISO format (e.g., 2025-01-31)",
        },
      },
      required: ["from", "to", "start_date", "end_date"],
    },
  },
  {
    name: "calculate_igv",
    description:
      "Calculate Peru IGV (18%) for a given amount. Returns base amount, IGV amount, and total.",
    inputSchema: {
      type: "object" as const,
      properties: {
        amount: {
          type: "number",
          description: "Base amount before IGV",
        },
        currency: {
          type: "string",
          description: "Currency code (default: PEN)",
        },
      },
      required: ["amount"],
    },
  },
  {
    name: "calculate_landed_cost",
    description:
      "Calculate total landed cost in PEN for imported goods. Takes FOB price, freight, insurance, duties, and IGV into account.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fob_price: {
          type: "number",
          description: "FOB price per unit in source currency",
        },
        fob_currency: {
          type: "string",
          description: "FOB price currency (e.g., USD, CNY). Default: USD",
        },
        qty: {
          type: "number",
          description: "Number of units (default: 1)",
        },
        freight_cost: {
          type: "number",
          description: "Total freight/shipping cost in USD (default: 0)",
        },
        insurance_cost: {
          type: "number",
          description: "Total insurance cost in USD (default: 0)",
        },
        customs_duty_rate: {
          type: "number",
          description: "Customs duty rate as decimal (e.g., 0.06 for 6%). Default: 0",
        },
        include_igv: {
          type: "boolean",
          description: "Include Peru IGV 18% in calculation (default: true)",
        },
      },
      required: ["fob_price"],
    },
  },
];

// ── MCP Server ──────────────────────────────────────

// Frankfurter client for historical data
const frankfurter = createHttpClient({
  baseUrl: "https://api.frankfurter.dev",
  timeout: 10_000,
});

const mcp = createMCPServer({
  name: 'forex-mcp',
  version: '0.1.0',
  tools: TOOLS,
  handler: async (name, args) => {
    switch (name) {
      case "get_exchange_rate": {
        const rate = await getRate(args.from as string, args.to as string);
        return formatJSON({
          from: (args.from as string).toUpperCase(),
          to: (args.to as string).toUpperCase(),
          rate,
          inverse_rate: 1 / rate,
        });
      }

      case "convert_amount": {
        const rate = await getRate(args.from as string, args.to as string);
        const converted = (args.amount as number) * rate;
        return formatJSON({
          from_amount: args.amount,
          from_currency: (args.from as string).toUpperCase(),
          to_amount: Math.round(converted * 100) / 100,
          to_currency: (args.to as string).toUpperCase(),
          rate,
        });
      }

      case "get_rate_history": {
        const fromCurrency = (args.from as string).toUpperCase();
        const toCurrency = (args.to as string).toUpperCase();

        const data = await frankfurter.get<{
          base?: string;
          start_date?: string;
          end_date?: string;
          rates?: Record<string, Record<string, number>>;
        }>(`/${args.start_date}..${args.end_date}?from=${fromCurrency}&to=${toCurrency}`);

        const rates = data.rates || {};
        const values = Object.values(rates).map((r) => r[toCurrency]);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg =
          values.length > 0
            ? values.reduce((s, v) => s + v, 0) / values.length
            : 0;

        return formatJSON({
          from: fromCurrency,
          to: toCurrency,
          start_date: args.start_date,
          end_date: args.end_date,
          data_points: values.length,
          summary: {
            min: Math.round(min * 10000) / 10000,
            max: Math.round(max * 10000) / 10000,
            avg: Math.round(avg * 10000) / 10000,
            change_pct:
              values.length >= 2
                ? Math.round(
                    ((values[values.length - 1] - values[0]) / values[0]) *
                      10000
                  ) / 100
                : 0,
          },
          rates,
        });
      }

      case "calculate_igv": {
        const base = args.amount as number;
        const igv = Math.round(base * IGV_RATE * 100) / 100;
        const total = Math.round((base + igv) * 100) / 100;
        const currency = (args.currency as string) || "PEN";

        return formatJSON({
          base_amount: base,
          igv_rate: `${IGV_RATE * 100}%`,
          igv_amount: igv,
          total: total,
          currency,
        });
      }

      case "calculate_landed_cost": {
        const fobCurrency = ((args.fob_currency as string) || "USD").toUpperCase();
        const qty = (args.qty as number) || 1;
        const freightUSD = (args.freight_cost as number) || 0;
        const insuranceUSD = (args.insurance_cost as number) || 0;
        const dutyRate = (args.customs_duty_rate as number) || 0;
        const includeIGV = args.include_igv !== false;

        let fobPerUnitUSD: number;
        if (fobCurrency === "USD") {
          fobPerUnitUSD = args.fob_price as number;
        } else {
          const rateToUSD = await getRate(fobCurrency, "USD");
          fobPerUnitUSD = (args.fob_price as number) * rateToUSD;
        }

        const totalFobUSD = fobPerUnitUSD * qty;
        const cifUSD = totalFobUSD + freightUSD + insuranceUSD;
        const customsDutyUSD = cifUSD * dutyRate;
        const subtotalUSD = cifUSD + customsDutyUSD;
        const igvUSD = includeIGV ? subtotalUSD * IGV_RATE : 0;
        const totalUSD = subtotalUSD + igvUSD;

        const usdToPen = await getRate("USD", "PEN");
        const round2 = (n: number) => Math.round(n * 100) / 100;

        const totalPEN = totalUSD * usdToPen;
        const perUnitPEN = totalPEN / qty;

        return formatJSON({
          breakdown: {
            fob_per_unit: { usd: round2(fobPerUnitUSD), pen: round2(fobPerUnitUSD * usdToPen) },
            fob_total: { usd: round2(totalFobUSD), pen: round2(totalFobUSD * usdToPen) },
            freight: { usd: round2(freightUSD), pen: round2(freightUSD * usdToPen) },
            insurance: { usd: round2(insuranceUSD), pen: round2(insuranceUSD * usdToPen) },
            cif: { usd: round2(cifUSD), pen: round2(cifUSD * usdToPen) },
            customs_duty: {
              rate: `${dutyRate * 100}%`,
              usd: round2(customsDutyUSD),
              pen: round2(customsDutyUSD * usdToPen),
            },
            subtotal: { usd: round2(subtotalUSD), pen: round2(subtotalUSD * usdToPen) },
            igv: {
              rate: includeIGV ? `${IGV_RATE * 100}%` : "excluded",
              usd: round2(igvUSD),
              pen: round2(igvUSD * usdToPen),
            },
          },
          total_landed_cost: { usd: round2(totalUSD), pen: round2(totalPEN) },
          per_unit_landed_cost: {
            usd: round2(totalUSD / qty),
            pen: round2(perUnitPEN),
          },
          qty,
          exchange_rate: { usd_pen: round2(usdToPen) },
        });
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
});

mcp.start();
