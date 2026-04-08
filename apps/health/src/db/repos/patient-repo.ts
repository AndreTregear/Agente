import { query, transaction } from '../pool.js';
import { encryptRow, decryptRow } from '../../crypto/middleware.js';

export interface PatientRecord {
  id: string;
  tenant_id: string;
  full_name: string;
  phone: string;
  dni?: string;
  date_of_birth?: string;
  sex?: 'M' | 'F';
  address?: string;
  emergency_contact?: string;
  created_at: string;
}

export interface ChildRecord {
  id: string;
  patient_id: string;
  tenant_id: string;
  full_name: string;
  date_of_birth: string;
  sex: 'M' | 'F';
  birth_weight_kg?: number;
  birth_height_cm?: number;
  blood_type?: string;
  allergies?: string;
  notes?: string;
  created_at: string;
}

/**
 * Create a new patient (parent/adult).
 */
export async function createPatient(
  data: Omit<PatientRecord, 'id' | 'created_at'>,
  dek?: Buffer,
): Promise<PatientRecord> {
  const row = dek ? encryptRow('patients', data as unknown as Record<string, unknown>, dek, data.tenant_id) : data;
  const result = await query<PatientRecord>(
    `INSERT INTO patients (tenant_id, full_name, phone, dni, date_of_birth, sex, address, emergency_contact)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [row.tenant_id, row.full_name, row.phone, row.dni, row.date_of_birth, row.sex, row.address, row.emergency_contact],
    data.tenant_id,
  );
  const patient = result.rows[0];
  return dek ? decryptRow('patients', patient as unknown as Record<string, unknown>, dek, data.tenant_id) as unknown as PatientRecord : patient;
}

/**
 * Find patient by phone number.
 */
export async function findPatientByPhone(
  tenantId: string,
  phone: string,
): Promise<PatientRecord | null> {
  // Since phone is encrypted, we need to scan and decrypt
  // In production, use a blind index for encrypted search
  const result = await query<PatientRecord>(
    `SELECT * FROM patients WHERE tenant_id = $1`,
    [tenantId],
    tenantId,
  );
  return result.rows.find(r => r.phone === phone) || null;
}

/**
 * Get all children for a patient.
 */
export async function getChildrenByPatient(
  tenantId: string,
  patientId: string,
  dek?: Buffer,
): Promise<ChildRecord[]> {
  const result = await query<ChildRecord>(
    `SELECT * FROM children WHERE tenant_id = $1 AND patient_id = $2 ORDER BY date_of_birth`,
    [tenantId, patientId],
    tenantId,
  );
  if (dek) {
    return result.rows.map(r => decryptRow('children', r as unknown as unknown as Record<string, unknown>, dek, tenantId) as unknown as ChildRecord);
  }
  return result.rows;
}

/**
 * Register a new child.
 */
export async function createChild(
  data: Omit<ChildRecord, 'id' | 'created_at'>,
  dek?: Buffer,
): Promise<ChildRecord> {
  const row = dek ? encryptRow('children', data as unknown as Record<string, unknown>, dek, data.tenant_id) : data;
  const result = await query<ChildRecord>(
    `INSERT INTO children (patient_id, tenant_id, full_name, date_of_birth, sex, birth_weight_kg, birth_height_cm, blood_type, allergies, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [row.patient_id, row.tenant_id, row.full_name, row.date_of_birth, row.sex, row.birth_weight_kg, row.birth_height_cm, row.blood_type, row.allergies, row.notes],
    data.tenant_id,
  );
  return result.rows[0];
}

/**
 * Record a growth measurement.
 */
export async function recordGrowthMeasurement(
  tenantId: string,
  childId: string,
  data: {
    weight_kg?: number;
    height_cm?: number;
    head_circ_cm?: number;
    muac_cm?: number;
    weight_for_age_z?: number;
    height_for_age_z?: number;
    weight_for_height_z?: number;
    bmi_for_age_z?: number;
    flags?: string[];
    notes?: string;
    recorded_by?: string;
  },
): Promise<void> {
  await query(
    `INSERT INTO growth_measurements (child_id, tenant_id, weight_kg, height_cm, head_circ_cm, muac_cm,
       weight_for_age_z, height_for_age_z, weight_for_height_z, bmi_for_age_z, flags, notes, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [childId, tenantId, data.weight_kg, data.height_cm, data.head_circ_cm, data.muac_cm,
      data.weight_for_age_z, data.height_for_age_z, data.weight_for_height_z, data.bmi_for_age_z,
      data.flags, data.notes, data.recorded_by],
    tenantId,
  );
}

/**
 * Record a food log entry.
 */
export async function recordFoodLog(
  tenantId: string,
  data: {
    patient_id: string;
    child_id?: string;
    raw_description: string;
    parsed_foods?: unknown;
    total_calories?: number;
    total_protein_g?: number;
    total_carbs_g?: number;
    total_fat_g?: number;
    total_iron_mg?: number;
    total_zinc_mg?: number;
    total_vitamin_a_mcg?: number;
    meal_type?: string;
  },
): Promise<void> {
  await query(
    `INSERT INTO food_logs (patient_id, child_id, tenant_id, raw_description, parsed_foods,
       total_calories, total_protein_g, total_carbs_g, total_fat_g, total_iron_mg, total_zinc_mg, total_vitamin_a_mcg, meal_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [data.patient_id, data.child_id, tenantId, data.raw_description, JSON.stringify(data.parsed_foods),
      data.total_calories, data.total_protein_g, data.total_carbs_g, data.total_fat_g,
      data.total_iron_mg, data.total_zinc_mg, data.total_vitamin_a_mcg, data.meal_type],
    tenantId,
  );
}

/**
 * Record a health reading (BP, glucose, etc.).
 */
export async function recordHealthReading(
  tenantId: string,
  data: {
    patient_id: string;
    reading_type: string;
    value_primary: number;
    value_secondary?: number;
    unit: string;
    classification: string;
    fasting?: boolean;
    notes?: string;
  },
): Promise<void> {
  await query(
    `INSERT INTO health_readings (patient_id, tenant_id, reading_type, value_primary, value_secondary, unit, classification, fasting, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [data.patient_id, tenantId, data.reading_type, data.value_primary, data.value_secondary,
      data.unit, data.classification, data.fasting, data.notes],
    tenantId,
  );
}
