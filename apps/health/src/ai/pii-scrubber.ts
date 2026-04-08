/**
 * PII Scrubber — Health-specific version.
 * Removes personally identifiable and protected health information
 * from conversation trajectories before they enter the RL training pipeline.
 */

// ── Peruvian phone numbers ──
const PHONE_RE = /(?:\+?51[\s-]?)?9\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g;

// ── Email addresses ──
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// ── RUC numbers: 10XXXXXXXXX or 20XXXXXXXXX (11 digits) ──
const RUC_RE = /\b(?:10|20)\d{9}\b/g;

// ── DNI numbers: 8-digit numbers preceded by context clues ──
const DNI_RE = /\b(?:DNI|dni|documento)[:\s]*(\d{8})\b/g;
const DNI_STANDALONE_RE = /\b\d{8}\b/g;

// ── Amounts: S/XXX.XX ──
const AMOUNT_RE = /S\/\.?\s?\d{1,3}(?:[,.]?\d{3})*(?:\.\d{1,2})?/g;

// ── Names after common patterns ──
const NAME_CONTEXT_RE =
  /(?:Paciente|paciente|Cliente|cliente|Nombre|nombre|Para|para|De|de|Señora?|señora?|Sra?\.?|sra?\.?|Sr\.?|sr\.?|Don|don|Doña|doña|Mamá|mamá|Papá|papá|Hijo|hijo|Hija|hija|Bebé|bebé)[:\s]+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3})/g;

// ── Health-specific PII patterns ──

// Patient IDs / Historia Clínica numbers
const PATIENT_ID_RE = /\b(?:HC|HCL|historia\s+cl[ií]nica|paciente\s+(?:n[uú]mero|#|nro))[:\s]*([A-Z0-9-]+)\b/gi;

// SIS (Seguro Integral de Salud) numbers
const SIS_RE = /\b(?:SIS|sis|seguro)[:\s]*(\d{6,12})\b/g;

// Medication names with dosages (protect specific prescriptions)
const PRESCRIPTION_RE = /(?:recet[oóa]|prescri(?:bi[oó]|pci[oó]n)|toma(?:r)?)\s+[\w\s]+\s+\d+\s*(?:mg|ml|mcg|UI|g)\b/gi;

// Blood pressure readings with patient context
const BP_WITH_NAME_RE = /(?:presi[oó]n|PA|TA)\s+(?:de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})\s*[:=]\s*\d{2,3}\/\d{2,3}/g;

// Glucose readings with patient context
const GLUCOSE_WITH_NAME_RE = /(?:glucosa|glicemia|az[uú]car)\s+(?:de\s+)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})\s*[:=]\s*\d{2,3}/g;

// Diagnosis patterns
const DIAGNOSIS_RE = /\b(?:diagn[oó]stic[oa](?:do|da)?|diagnosticaron|tiene|padece)\s*:?\s*([A-Za-záéíóúñ\s]+?)(?:\.|,|$)/gi;

// Addresses
const ADDRESS_RE = /(?:Jr\.?|Av\.?|Calle|Mz\.?|Lt\.?|Pasaje|Pje\.?)\s+[A-Za-záéíóúñ\s\d#.-]+/g;

/**
 * Scrub PII and PHI from a single text string.
 */
export function scrubPII(text: string): string {
  let result = text;

  // 1. Emails
  result = result.replace(EMAIL_RE, '[EMAIL]');

  // 2. RUC
  result = result.replace(RUC_RE, '[RUC]');

  // 3. Patient IDs / HC numbers
  result = result.replace(PATIENT_ID_RE, '[PATIENT_ID]');

  // 4. SIS numbers
  result = result.replace(SIS_RE, (_match, _num: string) => '[SIS_ID]');

  // 5. DNI with context
  result = result.replace(DNI_RE, () => '[DNI]');

  // 6. Phone numbers
  result = result.replace(PHONE_RE, '[PHONE]');

  // 7. Amounts
  result = result.replace(AMOUNT_RE, '[AMOUNT]');

  // 8. BP readings with names
  result = result.replace(BP_WITH_NAME_RE, (match, name: string) =>
    match.replace(name, '[PATIENT_NAME]'),
  );

  // 9. Glucose readings with names
  result = result.replace(GLUCOSE_WITH_NAME_RE, (match, name: string) =>
    match.replace(name, '[PATIENT_NAME]'),
  );

  // 10. Addresses
  result = result.replace(ADDRESS_RE, '[ADDRESS]');

  // 11. Names after context patterns
  result = result.replace(NAME_CONTEXT_RE, (match, name: string) =>
    match.replace(name, '[PATIENT_NAME]'),
  );

  // 12. Standalone 8-digit numbers (potential DNIs)
  result = result.replace(DNI_STANDALONE_RE, (match, offset: number) => {
    const before = result[offset - 1];
    if (before && /\d/.test(before)) return match;
    return '[DNI]';
  });

  return result;
}

/**
 * Scrub PII from an entire conversation (array of messages).
 */
export function scrubConversation(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  return messages.map((msg) => ({
    role: msg.role,
    content: scrubPII(msg.content),
  }));
}
