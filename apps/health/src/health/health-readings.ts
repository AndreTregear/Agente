/**
 * Health readings module — Blood pressure classification, glucose tracking, alerts.
 * Follows international guidelines (JNC 8, ADA) adapted for Peruvian context.
 */

// ── Blood Pressure Classification (JNC 8 / ACC/AHA 2017) ──

export interface BPReading {
  systolic: number;
  diastolic: number;
  measuredAt: Date;
  classification: string;
  alerts: string[];
  recommendations: string[];
}

export function classifyBloodPressure(systolic: number, diastolic: number): BPReading {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  let classification: string;

  if (systolic < 90 || diastolic < 60) {
    classification = 'hipotension';
    alerts.push('Presión arterial baja');
    recommendations.push('Si sientes mareos o debilidad, acuéstate y eleva las piernas.');
    recommendations.push('Toma líquidos y consulta con tu médico si persiste.');
  } else if (systolic < 120 && diastolic < 80) {
    classification = 'normal';
    recommendations.push('¡Tu presión está bien! Sigue con hábitos saludables.');
  } else if (systolic < 130 && diastolic < 80) {
    classification = 'elevada';
    recommendations.push('Presión ligeramente elevada. Reduce el consumo de sal.');
    recommendations.push('Camina al menos 30 minutos al día.');
  } else if (systolic < 140 || diastolic < 90) {
    classification = 'hipertension_grado1';
    alerts.push('Hipertensión grado 1');
    recommendations.push('Consulta con tu médico para evaluación.');
    recommendations.push('Reduce sal, grasas y alimentos procesados.');
    recommendations.push('Aumenta consumo de frutas, verduras y cereales integrales.');
    recommendations.push('Evita el alcohol y el tabaco.');
  } else if (systolic < 180 && diastolic < 120) {
    classification = 'hipertension_grado2';
    alerts.push('Hipertensión grado 2 — consulta médica necesaria');
    recommendations.push('Acude al centro de salud para evaluación y tratamiento.');
    recommendations.push('Si tomas medicamentos, NO los dejes sin consultar al médico.');
  } else {
    classification = 'crisis_hipertensiva';
    alerts.push('⚠️ CRISIS HIPERTENSIVA — busca atención médica INMEDIATA');
    recommendations.push('Acude a emergencias AHORA.');
    recommendations.push('No esperes. Presión muy alta puede causar daño a órganos.');
  }

  return {
    systolic,
    diastolic,
    measuredAt: new Date(),
    classification,
    alerts,
    recommendations,
  };
}

// ── Glucose Classification (ADA Standards) ──

export interface GlucoseReading {
  value: number; // mg/dL
  fasting: boolean;
  measuredAt: Date;
  classification: string;
  alerts: string[];
  recommendations: string[];
}

export function classifyGlucose(value: number, fasting: boolean): GlucoseReading {
  const alerts: string[] = [];
  const recommendations: string[] = [];
  let classification: string;

  if (fasting) {
    if (value < 54) {
      classification = 'hipoglucemia_severa';
      alerts.push('⚠️ HIPOGLUCEMIA SEVERA — necesita atención INMEDIATA');
      recommendations.push('Toma jugo de fruta, miel o azúcar AHORA.');
      recommendations.push('Si los síntomas no mejoran en 15 minutos, busca ayuda médica.');
    } else if (value < 70) {
      classification = 'hipoglucemia';
      alerts.push('Glucosa baja');
      recommendations.push('Come algo dulce: jugo, fruta, galletas.');
      recommendations.push('Mide de nuevo en 15 minutos.');
    } else if (value <= 99) {
      classification = 'normal';
      recommendations.push('Tu glucosa en ayunas está normal. ¡Sigue así!');
    } else if (value <= 125) {
      classification = 'prediabetes';
      alerts.push('Prediabetes — glucosa en ayunas elevada');
      recommendations.push('Consulta con tu médico para evaluación.');
      recommendations.push('Reduce azúcar, harinas blancas y gaseosas.');
      recommendations.push('Aumenta actividad física: caminar 30 min/día.');
      recommendations.push('Consume más quinua, menestras y verduras.');
    } else {
      classification = 'diabetes';
      alerts.push('Glucosa alta — compatible con diabetes');
      recommendations.push('Consulta con tu médico URGENTE para confirmar diagnóstico.');
      recommendations.push('NO dejes de tomar tus medicamentos si ya los tienes.');
    }
  } else {
    // Postprandial (2h after eating)
    if (value < 54) {
      classification = 'hipoglucemia_severa';
      alerts.push('⚠️ HIPOGLUCEMIA SEVERA — necesita atención INMEDIATA');
      recommendations.push('Toma jugo de fruta, miel o azúcar AHORA.');
    } else if (value < 70) {
      classification = 'hipoglucemia';
      alerts.push('Glucosa baja después de comer');
      recommendations.push('Come algo dulce y consulta con tu médico.');
    } else if (value <= 140) {
      classification = 'normal';
      recommendations.push('Tu glucosa después de comer está normal.');
    } else if (value <= 199) {
      classification = 'prediabetes';
      alerts.push('Glucosa elevada después de comer');
      recommendations.push('Reduce porciones de arroz, pan y fideos.');
      recommendations.push('Agrega más verduras y proteínas a cada comida.');
    } else {
      classification = 'diabetes';
      alerts.push('Glucosa muy alta después de comer');
      recommendations.push('Consulta con tu médico para ajustar tratamiento.');
    }
  }

  return {
    value,
    fasting,
    measuredAt: new Date(),
    classification,
    alerts,
    recommendations,
  };
}

// ── BMI Classification (Adults) ──

export interface BMIResult {
  bmi: number;
  classification: string;
  recommendations: string[];
}

export function classifyBMI(weightKg: number, heightCm: number): BMIResult {
  const heightM = heightCm / 100;
  const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  const recommendations: string[] = [];
  let classification: string;

  if (bmi < 18.5) {
    classification = 'bajo_peso';
    recommendations.push('Peso por debajo de lo normal. Consulta con un nutricionista.');
    recommendations.push('Aumenta el consumo de alimentos nutritivos y energéticos.');
  } else if (bmi < 25) {
    classification = 'normal';
    recommendations.push('Tu peso está en rango normal. ¡Mantén tus buenos hábitos!');
  } else if (bmi < 30) {
    classification = 'sobrepeso';
    recommendations.push('Reduce porciones y alimentos fritos/procesados.');
    recommendations.push('Aumenta actividad física: 150 min/semana mínimo.');
    recommendations.push('Prefiere agua sobre gaseosas y jugos azucarados.');
  } else if (bmi < 35) {
    classification = 'obesidad_grado1';
    recommendations.push('Consulta con tu médico para plan de alimentación.');
    recommendations.push('La actividad física regular es fundamental.');
  } else if (bmi < 40) {
    classification = 'obesidad_grado2';
    recommendations.push('Consulta médica necesaria para tratamiento integral.');
  } else {
    classification = 'obesidad_grado3';
    recommendations.push('Consulta médica URGENTE. Riesgo alto de complicaciones.');
  }

  return { bmi, classification, recommendations };
}

// ── Format as WhatsApp message ──

export function formatBPMessage(reading: BPReading): string {
  const lines: string[] = [];
  const emoji = reading.classification === 'normal' ? '✅' :
    reading.classification === 'elevada' ? '🔶' : '⚠️';

  lines.push(`${emoji} *Presión arterial: ${reading.systolic}/${reading.diastolic} mmHg*`);
  lines.push(`📋 Clasificación: ${reading.classification.replace(/_/g, ' ')}`);

  if (reading.alerts.length > 0) {
    lines.push('');
    for (const alert of reading.alerts) {
      lines.push(`🚨 ${alert}`);
    }
  }

  if (reading.recommendations.length > 0) {
    lines.push('');
    lines.push('💡 *Recomendaciones:*');
    for (const rec of reading.recommendations) {
      lines.push(`  • ${rec}`);
    }
  }

  lines.push('');
  lines.push('_Yaya Salud es un asistente informativo. No reemplaza la consulta médica._');
  return lines.join('\n');
}

export function formatGlucoseMessage(reading: GlucoseReading): string {
  const lines: string[] = [];
  const emoji = reading.classification === 'normal' ? '✅' :
    reading.classification.includes('hipoglucemia') ? '🔴' : '⚠️';
  const fastingText = reading.fasting ? 'en ayunas' : 'después de comer';

  lines.push(`${emoji} *Glucosa ${fastingText}: ${reading.value} mg/dL*`);
  lines.push(`📋 Clasificación: ${reading.classification.replace(/_/g, ' ')}`);

  if (reading.alerts.length > 0) {
    lines.push('');
    for (const alert of reading.alerts) {
      lines.push(`🚨 ${alert}`);
    }
  }

  if (reading.recommendations.length > 0) {
    lines.push('');
    lines.push('💡 *Recomendaciones:*');
    for (const rec of reading.recommendations) {
      lines.push(`  • ${rec}`);
    }
  }

  lines.push('');
  lines.push('_Yaya Salud es un asistente informativo. No reemplaza la consulta médica._');
  return lines.join('\n');
}
