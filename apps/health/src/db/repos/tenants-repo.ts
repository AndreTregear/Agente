/**
 * Tenant CRUD — manages health platform tenants (clinics, health workers, etc.)
 */

import { query } from '../pool.js';
import { logger } from '../../shared/logger.js';

export interface Tenant {
  id: string;
  name: string;
  phone: string | null;
  status: 'active' | 'paused' | 'inactive';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export async function createTenant(
  name: string,
  phone: string | null,
  status: 'active' | 'paused' | 'inactive' = 'active',
): Promise<Tenant> {
  const result = await query<Tenant>(
    `INSERT INTO tenants (name, phone, status, active, updated_at)
     VALUES ($1, $2, $3, $4, now())
     RETURNING *`,
    [name, phone, status, status === 'active'],
  );
  const tenant = result.rows[0];

  // Create a session row for the tenant
  await query(
    `INSERT INTO tenant_sessions (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [tenant.id],
  );

  logger.info({ tenantId: tenant.id, name }, 'Tenant created');
  return tenant;
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const result = await query<Tenant>(
    `SELECT * FROM tenants WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getActiveTenants(): Promise<Tenant[]> {
  const result = await query<Tenant>(
    `SELECT * FROM tenants WHERE status = 'active' ORDER BY created_at DESC`,
  );
  return result.rows;
}

export async function getAllTenants(): Promise<Tenant[]> {
  const result = await query<Tenant>(
    `SELECT * FROM tenants ORDER BY created_at DESC`,
  );
  return result.rows;
}

export async function updateTenantStatus(
  id: string,
  status: 'active' | 'paused' | 'inactive',
): Promise<Tenant | null> {
  const result = await query<Tenant>(
    `UPDATE tenants SET status = $1, active = $2, updated_at = now()
     WHERE id = $3 RETURNING *`,
    [status, status === 'active', id],
  );
  if (result.rows[0]) {
    logger.info({ tenantId: id, status }, 'Tenant status updated');
  }
  return result.rows[0] ?? null;
}

export async function updateTenant(
  id: string,
  data: Partial<Pick<Tenant, 'name' | 'phone' | 'status'>>,
): Promise<Tenant | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${idx++}`);
    params.push(data.name);
  }
  if (data.phone !== undefined) {
    sets.push(`phone = $${idx++}`);
    params.push(data.phone);
  }
  if (data.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(data.status);
    sets.push(`active = $${idx++}`);
    params.push(data.status === 'active');
  }

  if (sets.length === 0) return getTenantById(id);

  sets.push(`updated_at = now()`);
  params.push(id);

  const result = await query<Tenant>(
    `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    params,
  );
  return result.rows[0] ?? null;
}
