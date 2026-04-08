#!/usr/bin/env node
/**
 * ERPNext MCP Server
 * Exposes ERPNext REST API as MCP tools for OpenClaw agents.
 */

import { createMCPServer, formatJSON } from '@yaya/mcp-base';
import { createHttpClient } from '@yaya/http-client';

const ERPNEXT_URL = process.env.ERPNEXT_URL || "http://localhost:8080";
const ERPNEXT_API_KEY = process.env.ERPNEXT_API_KEY || "";
const ERPNEXT_API_SECRET = process.env.ERPNEXT_API_SECRET || "";

// ── ERPNext HTTP Client ──────────────────────────────

const erp = createHttpClient({
  baseUrl: `${ERPNEXT_URL}/api`,
  auth: ERPNEXT_API_KEY
    ? { type: 'token', value: `token ${ERPNEXT_API_KEY}:${ERPNEXT_API_SECRET}` }
    : undefined,
  timeout: 10_000,
  retries: 2,
  retryDelay: 1_000,
});

// ── Tool Definitions ──────────────────────────────────

const TOOLS = [
  {
    name: "search_products",
    description:
      "Search the product catalog by name, category, or keyword. Returns matching items with prices and stock.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product",
    description: "Get full details for a specific product including price, stock, and description.",
    inputSchema: {
      type: "object" as const,
      properties: {
        item_code: { type: "string", description: "ERPNext Item Code" },
      },
      required: ["item_code"],
    },
  },
  {
    name: "check_stock",
    description: "Check current stock quantity for an item across warehouses.",
    inputSchema: {
      type: "object" as const,
      properties: {
        item_code: { type: "string", description: "ERPNext Item Code" },
        warehouse: { type: "string", description: "Warehouse name (optional)" },
      },
      required: ["item_code"],
    },
  },
  {
    name: "create_order",
    description:
      "Create a new sales order for a customer. Requires customer name and list of items.",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer: { type: "string", description: "Customer name" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item_code: { type: "string" },
              qty: { type: "number" },
              rate: { type: "number", description: "Price per unit (optional)" },
            },
            required: ["item_code", "qty"],
          },
          description: "List of items to order",
        },
        notes: { type: "string", description: "Order notes (optional)" },
      },
      required: ["customer", "items"],
    },
  },
  {
    name: "get_order",
    description: "Get the status and details of an existing sales order.",
    inputSchema: {
      type: "object" as const,
      properties: {
        order_id: { type: "string", description: "Sales Order ID (e.g., SO-00001)" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "list_customers",
    description: "Search customers by name, phone, or email.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "create_customer",
    description: "Create a new customer in ERPNext. Returns the created customer record.",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer_name: { type: "string", description: "Full customer name" },
        customer_type: {
          type: "string",
          enum: ["Individual", "Company"],
          description: "Customer type (default: Individual)",
        },
        mobile_no: { type: "string", description: "Mobile number (optional)" },
        email_id: { type: "string", description: "Email address (optional)" },
        customer_group: {
          type: "string",
          description: "Customer group (e.g., Commercial, Individual). Optional.",
        },
        territory: {
          type: "string",
          description: "Territory (optional)",
        },
      },
      required: ["customer_name"],
    },
  },
  {
    name: "update_order",
    description: "Update an existing sales order. Can modify items, notes, or delivery date.",
    inputSchema: {
      type: "object" as const,
      properties: {
        order_id: { type: "string", description: "Sales Order ID (e.g., SO-00001)" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item_code: { type: "string" },
              qty: { type: "number" },
              rate: { type: "number", description: "Price per unit (optional)" },
            },
            required: ["item_code", "qty"],
          },
          description: "Updated list of items (replaces existing items)",
        },
        delivery_date: { type: "string", description: "New delivery date (ISO format, optional)" },
        notes: { type: "string", description: "Updated order notes (optional)" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "cancel_order",
    description: "Cancel a submitted sales order. The order must be in a cancellable state.",
    inputSchema: {
      type: "object" as const,
      properties: {
        order_id: { type: "string", description: "Sales Order ID (e.g., SO-00001)" },
        reason: { type: "string", description: "Cancellation reason (optional)" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "list_orders",
    description:
      "List recent sales orders with optional filters by customer, status, or date range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer: { type: "string", description: "Filter by customer name (optional)" },
        status: {
          type: "string",
          enum: ["Draft", "To Deliver and Bill", "To Bill", "To Deliver", "Completed", "Cancelled"],
          description: "Filter by order status (optional)",
        },
        from_date: { type: "string", description: "Start date filter, ISO format (optional)" },
        to_date: { type: "string", description: "End date filter, ISO format (optional)" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "get_item_price",
    description:
      "Get pricing for an item including standard rate, price list rates, and any applicable discounts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        item_code: { type: "string", description: "ERPNext Item Code" },
        price_list: {
          type: "string",
          description: "Price list name (optional, defaults to Standard Selling)",
        },
        customer: {
          type: "string",
          description: "Customer name to check for customer-specific pricing (optional)",
        },
        qty: {
          type: "number",
          description: "Quantity to check for volume discounts (optional)",
        },
      },
      required: ["item_code"],
    },
  },
  {
    name: "create_quotation",
    description:
      "Create a price quotation for a customer. Can be converted to a sales order later.",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer: { type: "string", description: "Customer name" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item_code: { type: "string" },
              qty: { type: "number" },
              rate: { type: "number", description: "Price per unit (optional)" },
            },
            required: ["item_code", "qty"],
          },
          description: "List of items for the quotation",
        },
        valid_till: {
          type: "string",
          description: "Quotation validity date (ISO format, optional)",
        },
        notes: { type: "string", description: "Quotation notes (optional)" },
      },
      required: ["customer", "items"],
    },
  },
  {
    name: "create_payment_entry",
    description:
      "Record a payment received against a sales order. Use after verifying payment (e.g., Yape screenshot).",
    inputSchema: {
      type: "object" as const,
      properties: {
        sales_order: { type: "string", description: "Sales Order ID (e.g., SO-00001)" },
        amount: { type: "number", description: "Payment amount received" },
        payment_method: {
          type: "string",
          enum: ["Cash", "Bank Transfer", "Yape", "Plin", "Credit Card", "Other"],
          description: "Mode of payment",
        },
        reference_number: {
          type: "string",
          description: "Payment reference number or transaction ID (optional)",
        },
        date: {
          type: "string",
          description: "Payment date, ISO format (optional, defaults to today)",
        },
      },
      required: ["sales_order", "amount", "payment_method"],
    },
  },
  {
    name: "create_purchase_order",
    description:
      "Create a purchase order to a supplier for restocking inventory.",
    inputSchema: {
      type: "object" as const,
      properties: {
        supplier: { type: "string", description: "Supplier name" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item_code: { type: "string" },
              qty: { type: "number" },
              rate: { type: "number", description: "Price per unit" },
            },
            required: ["item_code", "qty", "rate"],
          },
          description: "List of items to order from supplier",
        },
        schedule_date: {
          type: "string",
          description: "Expected delivery date, ISO format (optional)",
        },
        notes: { type: "string", description: "Order notes (optional)" },
      },
      required: ["supplier", "items"],
    },
  },
  {
    name: "create_item",
    description: "Add a new product to the ERPNext catalog.",
    inputSchema: {
      type: "object" as const,
      properties: {
        item_name: { type: "string", description: "Product name" },
        item_code: {
          type: "string",
          description: "Unique item code (optional, auto-generated if omitted)",
        },
        item_group: {
          type: "string",
          description: "Item group/category (e.g., Products, Raw Material)",
        },
        standard_rate: { type: "number", description: "Standard selling price" },
        description: { type: "string", description: "Product description (optional)" },
        stock_uom: { type: "string", description: "Unit of measure (default: Nos)" },
        is_stock_item: {
          type: "boolean",
          description: "Whether to track stock (default: true)",
        },
      },
      required: ["item_name", "item_group", "standard_rate"],
    },
  },
  {
    name: "update_item",
    description:
      "Update an existing product's details such as price, description, or stock settings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        item_code: { type: "string", description: "ERPNext Item Code" },
        standard_rate: { type: "number", description: "New standard selling price (optional)" },
        description: { type: "string", description: "Updated description (optional)" },
        item_name: { type: "string", description: "Updated product name (optional)" },
        disabled: { type: "boolean", description: "Set to true to disable the item (optional)" },
      },
      required: ["item_code"],
    },
  },
  {
    name: "get_sales_summary",
    description:
      "Get aggregate sales data: total revenue, order count, and top-selling products for a date range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        from_date: { type: "string", description: "Start date, ISO format (e.g., 2025-01-01)" },
        to_date: { type: "string", description: "End date, ISO format (e.g., 2025-01-31)" },
        customer: { type: "string", description: "Filter by customer (optional)" },
      },
      required: ["from_date", "to_date"],
    },
  },
  {
    name: "get_customer_balance",
    description:
      "Get the total outstanding balance for a customer across all unpaid invoices and orders.",
    inputSchema: {
      type: "object" as const,
      properties: {
        customer: { type: "string", description: "Customer name" },
      },
      required: ["customer"],
    },
  },
  {
    name: "health_check",
    description:
      "Ping ERPNext and return connection status, version, and response time.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// ── MCP Server ───────────────────────────────────────

const mcp = createMCPServer({
  name: 'erpnext-mcp',
  version: '0.1.0',
  tools: TOOLS,
  handler: async (name, args) => {
    switch (name) {
      case "search_products": {
        const limit = args.limit || 10;
        const data = await erp.get<any>(
          `/resource/Item?filters=[["item_name","like","%${args.query}%"]]&fields=["item_code","item_name","standard_rate","stock_uom","item_group"]&limit_page_length=${limit}`
        );
        return formatJSON(data.data);
      }

      case "get_product": {
        const data = await erp.get<any>(`/resource/Item/${args.item_code}`);
        return formatJSON(data.data);
      }

      case "check_stock": {
        const filters = args.warehouse
          ? `[["item_code","=","${args.item_code}"],["warehouse","=","${args.warehouse}"]]`
          : `[["item_code","=","${args.item_code}"]]`;
        const data = await erp.get<any>(
          `/resource/Bin?filters=${filters}&fields=["warehouse","actual_qty","projected_qty"]`
        );
        return formatJSON(data.data);
      }

      case "create_order": {
        const order = {
          doctype: "Sales Order",
          customer: args.customer,
          items: (args.items as any[]).map((item: any) => ({
            item_code: item.item_code,
            qty: item.qty,
            ...(item.rate ? { rate: item.rate } : {}),
          })),
          ...(args.notes ? { notes: args.notes } : {}),
        };
        const data = await erp.post<any>("/resource/Sales Order", { data: order });
        return formatJSON(data.data);
      }

      case "get_order": {
        const data = await erp.get<any>(`/resource/Sales Order/${args.order_id}`);
        return formatJSON(data.data);
      }

      case "list_customers": {
        const limit = args.limit || 10;
        const data = await erp.get<any>(
          `/resource/Customer?filters=[["customer_name","like","%${args.query}%"]]&fields=["name","customer_name","mobile_no","email_id"]&limit_page_length=${limit}`
        );
        return formatJSON(data.data);
      }

      case "create_customer": {
        const customer: Record<string, any> = {
          doctype: "Customer",
          customer_name: args.customer_name,
          customer_type: args.customer_type || "Individual",
        };
        if (args.mobile_no) customer.mobile_no = args.mobile_no;
        if (args.email_id) customer.email_id = args.email_id;
        if (args.customer_group) customer.customer_group = args.customer_group;
        if (args.territory) customer.territory = args.territory;

        const data = await erp.post<any>("/resource/Customer", { data: customer });
        return formatJSON(data.data);
      }

      case "update_order": {
        const updates: Record<string, any> = {};
        if (args.items) {
          updates.items = (args.items as any[]).map((item: any) => ({
            item_code: item.item_code,
            qty: item.qty,
            ...(item.rate ? { rate: item.rate } : {}),
          }));
        }
        if (args.delivery_date) updates.delivery_date = args.delivery_date;
        if (args.notes) updates.notes = args.notes;

        if (Object.keys(updates).length === 0) {
          throw new Error("No fields to update. Provide items, delivery_date, or notes.");
        }

        const data = await erp.put<any>(`/resource/Sales Order/${args.order_id}`, { data: updates });
        return formatJSON(data.data);
      }

      case "cancel_order": {
        await erp.post<any>("/method/frappe.client.cancel", {
          doctype: "Sales Order",
          name: args.order_id,
        });
        const result: Record<string, any> = {
          order_id: args.order_id,
          status: "Cancelled",
        };
        if (args.reason) result.reason = args.reason;
        return formatJSON(result);
      }

      case "list_orders": {
        const limit = args.limit || 20;
        const filters: string[][] = [];
        if (args.customer) {
          filters.push(["customer", "like", `%${args.customer}%`]);
        }
        if (args.status) {
          filters.push(["status", "=", args.status as string]);
        }
        if (args.from_date) {
          filters.push(["transaction_date", ">=", args.from_date as string]);
        }
        if (args.to_date) {
          filters.push(["transaction_date", "<=", args.to_date as string]);
        }

        const filtersParam = filters.length > 0
          ? `&filters=${encodeURIComponent(JSON.stringify(filters))}`
          : "";
        const data = await erp.get<any>(
          `/resource/Sales Order?fields=${encodeURIComponent(JSON.stringify(["name", "customer", "grand_total", "status", "transaction_date", "delivery_date", "currency"]))}&limit_page_length=${limit}&order_by=transaction_date desc${filtersParam}`
        );
        return formatJSON(data.data);
      }

      case "get_item_price": {
        const priceList = args.price_list || "Standard Selling";
        const item = await erp.get<any>(
          `/resource/Item/${encodeURIComponent(args.item_code as string)}?fields=["item_code","item_name","standard_rate","stock_uom"]`
        );

        const priceFilters = [
          ["item_code", "=", args.item_code],
          ["price_list", "=", priceList],
        ];
        const prices = await erp.get<any>(
          `/resource/Item Price?filters=${encodeURIComponent(JSON.stringify(priceFilters))}&fields=["price_list_rate","currency","min_qty","valid_from","valid_upto"]&limit_page_length=10`
        );

        const pricingRuleFilters = [
          ["apply_on", "=", "Item Code"],
          ["items", "like", `%${args.item_code}%`],
          ["disable", "=", 0],
        ];
        let pricingRules: any[] = [];
        try {
          const rules = await erp.get<any>(
            `/resource/Pricing Rule?filters=${encodeURIComponent(JSON.stringify(pricingRuleFilters))}&fields=["name","title","discount_percentage","discount_amount","min_qty","valid_from","valid_upto"]&limit_page_length=10`
          );
          pricingRules = rules.data || [];
        } catch {
          // Pricing rules may not be accessible
        }

        return formatJSON({
          item: item.data,
          price_list_rates: prices.data || [],
          pricing_rules: pricingRules,
        });
      }

      case "create_quotation": {
        const quotation: Record<string, any> = {
          doctype: "Quotation",
          quotation_to: "Customer",
          party_name: args.customer,
          items: (args.items as any[]).map((item: any) => ({
            item_code: item.item_code,
            qty: item.qty,
            ...(item.rate ? { rate: item.rate } : {}),
          })),
        };
        if (args.valid_till) quotation.valid_till = args.valid_till;
        if (args.notes) quotation.notes = args.notes;

        const data = await erp.post<any>("/resource/Quotation", { data: quotation });
        return formatJSON(data.data);
      }

      case "create_payment_entry": {
        const so = await erp.get<any>(`/resource/Sales Order/${args.sales_order}`);
        const soData = so.data;
        const paymentDate = (args.date as string) || new Date().toISOString().split("T")[0];

        const payment: Record<string, any> = {
          doctype: "Payment Entry",
          payment_type: "Receive",
          party_type: "Customer",
          party: soData.customer,
          paid_amount: args.amount,
          received_amount: args.amount,
          target_exchange_rate: 1,
          paid_to_account_currency: soData.currency || "PEN",
          mode_of_payment: args.payment_method,
          reference_no: (args.reference_number as string) || "",
          reference_date: paymentDate,
          posting_date: paymentDate,
          references: [
            {
              reference_doctype: "Sales Order",
              reference_name: args.sales_order,
              allocated_amount: args.amount,
            },
          ],
        };

        const data = await erp.post<any>("/resource/Payment Entry", { data: payment });
        return formatJSON(data.data);
      }

      case "create_purchase_order": {
        const scheduleDate =
          (args.schedule_date as string) || new Date().toISOString().split("T")[0];
        const po: Record<string, any> = {
          doctype: "Purchase Order",
          supplier: args.supplier,
          items: (args.items as any[]).map((item: any) => ({
            item_code: item.item_code,
            qty: item.qty,
            rate: item.rate,
            schedule_date: scheduleDate,
          })),
        };
        if (args.notes) po.notes = args.notes;

        const data = await erp.post<any>("/resource/Purchase Order", { data: po });
        return formatJSON(data.data);
      }

      case "create_item": {
        const item: Record<string, any> = {
          doctype: "Item",
          item_name: args.item_name,
          item_group: args.item_group,
          standard_rate: args.standard_rate,
          stock_uom: args.stock_uom || "Nos",
          is_stock_item: args.is_stock_item !== false ? 1 : 0,
        };
        if (args.item_code) item.item_code = args.item_code;
        if (args.description) item.description = args.description;

        const data = await erp.post<any>("/resource/Item", { data: item });
        return formatJSON(data.data);
      }

      case "update_item": {
        const updates: Record<string, any> = {};
        if (args.standard_rate !== undefined) updates.standard_rate = args.standard_rate;
        if (args.description !== undefined) updates.description = args.description;
        if (args.item_name !== undefined) updates.item_name = args.item_name;
        if (args.disabled !== undefined) updates.disabled = args.disabled ? 1 : 0;

        if (Object.keys(updates).length === 0) {
          throw new Error(
            "No fields to update. Provide standard_rate, description, item_name, or disabled."
          );
        }

        const data = await erp.put<any>(
          `/resource/Item/${encodeURIComponent(args.item_code as string)}`,
          { data: updates }
        );
        return formatJSON(data.data);
      }

      case "get_sales_summary": {
        const soFilters: any[][] = [
          ["transaction_date", ">=", args.from_date],
          ["transaction_date", "<=", args.to_date],
          ["docstatus", "=", 1],
        ];
        if (args.customer) {
          soFilters.push(["customer", "like", `%${args.customer}%`]);
        }

        const orders = await erp.get<any>(
          `/resource/Sales Order?filters=${encodeURIComponent(JSON.stringify(soFilters))}&fields=${encodeURIComponent(JSON.stringify(["name", "customer", "grand_total", "status", "transaction_date", "currency"]))}&limit_page_length=0`
        );

        const orderList: any[] = orders.data || [];
        const totalRevenue = orderList.reduce(
          (sum: number, o: any) => sum + (o.grand_total || 0),
          0
        );

        const productCounts: Record<string, { qty: number; revenue: number }> = {};
        for (const order of orderList) {
          try {
            const detail = await erp.get<any>(`/resource/Sales Order/${order.name}`);
            const items: any[] = detail.data?.items || [];
            for (const it of items) {
              if (!productCounts[it.item_code]) {
                productCounts[it.item_code] = { qty: 0, revenue: 0 };
              }
              productCounts[it.item_code].qty += it.qty || 0;
              productCounts[it.item_code].revenue += it.amount || 0;
            }
          } catch {
            // Skip orders whose details we can't fetch
          }
        }

        const topProducts = Object.entries(productCounts)
          .sort(([, a], [, b]) => b.revenue - a.revenue)
          .slice(0, 10)
          .map(([item_code, stats]) => ({ item_code, ...stats }));

        return formatJSON({
          from_date: args.from_date,
          to_date: args.to_date,
          total_revenue: totalRevenue,
          order_count: orderList.length,
          currency: orderList[0]?.currency || "PEN",
          top_products: topProducts,
        });
      }

      case "get_customer_balance": {
        const invFilters = [
          ["customer", "=", args.customer],
          ["docstatus", "=", 1],
          ["outstanding_amount", ">", 0],
        ];
        const invoices = await erp.get<any>(
          `/resource/Sales Invoice?filters=${encodeURIComponent(JSON.stringify(invFilters))}&fields=${encodeURIComponent(JSON.stringify(["name", "grand_total", "outstanding_amount", "posting_date", "currency"]))}&limit_page_length=0`
        );
        const invoiceList: any[] = invoices.data || [];
        const totalOutstanding = invoiceList.reduce(
          (sum: number, inv: any) => sum + (inv.outstanding_amount || 0),
          0
        );

        const soFilters = [
          ["customer", "=", args.customer],
          ["docstatus", "=", 1],
          ["status", "in", ["To Deliver and Bill", "To Bill"]],
        ];
        const salesOrders = await erp.get<any>(
          `/resource/Sales Order?filters=${encodeURIComponent(JSON.stringify(soFilters))}&fields=${encodeURIComponent(JSON.stringify(["name", "grand_total", "advance_paid", "status", "transaction_date", "currency"]))}&limit_page_length=0`
        );
        const soList: any[] = salesOrders.data || [];
        const unbilledTotal = soList.reduce(
          (sum: number, s: any) => sum + ((s.grand_total || 0) - (s.advance_paid || 0)),
          0
        );

        return formatJSON({
          customer: args.customer,
          outstanding_invoices: totalOutstanding,
          unbilled_orders: unbilledTotal,
          total_balance: totalOutstanding + unbilledTotal,
          currency: invoiceList[0]?.currency || soList[0]?.currency || "PEN",
          invoice_count: invoiceList.length,
          unpaid_order_count: soList.length,
          invoices: invoiceList,
          orders: soList,
        });
      }

      case "health_check": {
        const start = Date.now();
        try {
          const data = await erp.get<any>("/method/frappe.handler.version");
          const latency = Date.now() - start;
          return formatJSON({
            status: "connected",
            url: ERPNEXT_URL,
            version: data.message || "unknown",
            latency_ms: latency,
            auth_configured: !!ERPNEXT_API_KEY,
          });
        } catch (err: any) {
          const latency = Date.now() - start;
          return formatJSON({
            status: "error",
            url: ERPNEXT_URL,
            error: err.message,
            latency_ms: latency,
            auth_configured: !!ERPNEXT_API_KEY,
          });
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  },
});

mcp.start();
