/**
 * Tests for ai/agents.ts — Mastra agent definitions and business tools.
 *
 * Tests tool schemas and tenant context management.
 * Actual tool execution requires a running database, so we mock db calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB pool
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  queryOne: vi.fn().mockResolvedValue(null),
}));

// Mock Yape tools
vi.mock('../src/ai/tools/yape-tools.js', () => ({
  checkYapePayment: { id: 'check-yape-payment', execute: vi.fn() },
  confirmYapePayment: { id: 'confirm-yape-payment', execute: vi.fn() },
  setCurrentTenantId: vi.fn(),
}));

// Mock logger
vi.mock('../src/shared/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const {
  setTenantId,
  getTenantId,
  businessMetrics,
  customerLookup,
  paymentStatus,
  calendarToday,
  sendMessage,
  allBusinessTools,
  allBusinessToolsWithYape,
  directAgent,
  whatsappAgent,
} = await import('../src/ai/agents.js');

describe('agents', () => {
  describe('tenant context', () => {
    beforeEach(() => {
      setTenantId('');
    });

    it('should set and get tenant ID', () => {
      setTenantId('tenant-123');
      expect(getTenantId()).toBe('tenant-123');
    });

    it('should return empty string when not set', () => {
      expect(getTenantId()).toBe('');
    });
  });

  describe('business tools', () => {
    it('should have all core tools', () => {
      expect(Object.keys(allBusinessTools).length).toBeGreaterThanOrEqual(8);
      expect(allBusinessTools.businessMetrics).toBeDefined();
      expect(allBusinessTools.customerLookup).toBeDefined();
      expect(allBusinessTools.paymentStatus).toBeDefined();
      expect(allBusinessTools.calendarToday).toBeDefined();
      expect(allBusinessTools.sendMessage).toBeDefined();
      expect(allBusinessTools.productCatalog).toBeDefined();
      expect(allBusinessTools.createOrder).toBeDefined();
      expect(allBusinessTools.getOrderStatus).toBeDefined();
    });

    it('should include Yape tools in extended set', () => {
      expect(Object.keys(allBusinessToolsWithYape).length).toBeGreaterThanOrEqual(10);
      expect(allBusinessToolsWithYape.checkYapePayment).toBeDefined();
      expect(allBusinessToolsWithYape.confirmYapePayment).toBeDefined();
    });
  });

  describe('businessMetrics tool', () => {
    it('should have correct schema', () => {
      expect(businessMetrics.id).toBe('business-metrics');
      expect(businessMetrics.description).toBeTruthy();
    });

    it('should return error when no tenant', async () => {
      setTenantId('');
      const result = await businessMetrics.execute!({ period: 'today' }, {} as any);
      expect(result).toHaveProperty('error');
    });

    it('should accept period values', async () => {
      setTenantId('test-tenant');
      // Will return empty data from mocked DB
      const result = await businessMetrics.execute!({ period: 'today' }, {} as any);
      expect(result).toHaveProperty('period');
    });
  });

  describe('customerLookup tool', () => {
    it('should have correct schema', () => {
      expect(customerLookup.id).toBe('customer-lookup');
    });

    it('should return error when no tenant', async () => {
      setTenantId('');
      const result = await customerLookup.execute!({ query: 'Juan' }, {} as any);
      expect(result).toHaveProperty('error');
    });

    it('should return no customers from empty DB', async () => {
      setTenantId('test-tenant');
      const result = await customerLookup.execute!({ query: 'Nobody' }, {} as any);
      expect(result.customers).toEqual([]);
    });
  });

  describe('paymentStatus tool', () => {
    it('should have correct schema', () => {
      expect(paymentStatus.id).toBe('payment-status');
    });

    it('should return error when no tenant', async () => {
      setTenantId('');
      const result = await paymentStatus.execute!({}, {} as any);
      expect(result).toHaveProperty('error');
    });
  });

  describe('calendarToday tool', () => {
    it('should have correct schema', () => {
      expect(calendarToday.id).toBe('calendar-today');
    });

    it('should return error when no tenant', async () => {
      setTenantId('');
      const result = await calendarToday.execute!({}, {} as any);
      expect(result).toHaveProperty('message');
    });
  });

  describe('sendMessage tool', () => {
    it('should have correct schema', () => {
      expect(sendMessage.id).toBe('send-message');
    });

    it('should return error when no tenant', async () => {
      setTenantId('');
      const result = await sendMessage.execute!(
        { phone: '987654321', message: 'test' },
        {} as any,
      );
      expect(result).toHaveProperty('error');
    });
  });

  describe('agent definitions', () => {
    it('should define directAgent', () => {
      expect(directAgent).toBeDefined();
      expect(directAgent.name).toBe('CEO Direct');
    });

    it('should define whatsappAgent', () => {
      expect(whatsappAgent).toBeDefined();
      expect(whatsappAgent.name).toBe('WhatsApp Business Agent');
    });

    it('should be Mastra Agent instances', () => {
      // Mastra agents may store instructions internally
      expect(typeof directAgent.generate).toBe('function');
      expect(typeof whatsappAgent.generate).toBe('function');
    });
  });
});
