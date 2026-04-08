# Yaya Salud — Vision & MVP Scope

## The Problem (from health.yaya.sh)

**43.7% of Peruvian children under 3 have anemia.** 70.7% in Puno.

The paradox: **52% of anemic children already eat enough iron.** The problem isn't iron deficiency — it's iron ABSORPTION. Three blockers:
1. **Parasites** — 40-100% prevalence in rural areas, block iron absorption
2. **Contaminated water** — only 3% of rural homes have chlorinated water → reinfection
3. **Dietary inhibitors** — anise/chamomile infusions given from 6 months reduce absorption 60-82%

Current programs spend billions on supplements that don't work because they treat symptoms, not causes.

## The Solution (Iguaín Model, Digitized)

Iguaín (Ayacucho) reduced anemia from 65% to 12% — won WHO Sasakawa Prize 2019. We digitize that model via WhatsApp.

## MVP — What the Agent MUST Do (conversationally)

The agent is a **nutritional AI companion for Peruvian mothers**. One WhatsApp conversation covers 95% of needs:

### Core Capabilities (Phase 1):

1. **Child Growth Tracking**
   - Mother says: "Mi hijo pesa 8 kilos y mide 68cm, tiene 10 meses"
   - Agent: calculates WHO z-scores, flags if stunted/underweight/wasted
   - Tracks over time, alerts on trends

2. **Food & Nutrition Guidance**
   - Mother says: "Qué le doy de comer a mi bebé de 8 meses?"
   - Agent: age-appropriate feeding guidance using LOCAL Peruvian foods
   - Prioritize iron-rich foods: sangrecita (27.3mg Fe), hígado, cushuro, cañihua
   - WARN about absorption blockers: "No le des infusiones de anís con las comidas"
   - Suggest absorption enhancers: vitamin C (camu camu, naranja, limón)

3. **Anemia Risk Assessment**
   - Simple screening questions (not diagnosis):
     - Does the child look pale? Tired? Not eating well?
     - Has the child been dewormed recently?
     - What water source do you use?
   - Risk level → recommend going to nearest CRED appointment

4. **General Health Q&A**
   - Answer common Peruvian health questions conversationally
   - When to go to the doctor, vaccine schedules, diarrhea management
   - Traditional remedies: validate safe ones, warn about harmful ones
   - ALWAYS: "Consulta con tu médico para un diagnóstico"

### Beyond Anemia — Generalized Health Needs

Anemia is the spearhead, but Peruvians need help with ALL of these (research-backed):

**Top health concerns (Statista Peru 2024):**
1. Mental health (46% say it's #1 problem)
2. Stress (41%)
3. Cancer awareness (40%)
4. Diabetes/hypertension (NCDs = 73% of deaths)
5. Access to care (76% say people can't afford good healthcare, 74% say wait times too long)

**Real latent needs the agent must handle conversationally:**

- **A mother tracking her anemic child** → growth, nutrition, iron absorption, deworming schedule
- **A son worried about his elderly mother** → "Mi mamá tiene 68 años, le duele el pecho, toma metformina" → risk assessment, when to go to ER, medication interactions
- **A diabetic managing daily life** → "Qué puedo desayunar?" → glucose-friendly Peruvian meals, when to check blood sugar
- **A pregnant woman** → prenatal nutrition, iron needs (double during pregnancy), warning signs
- **A rural farmer with chest pain** → triage: "Estos síntomas son de emergencia. Ve al centro de salud MÁS CERCANO ahora."
- **A teenager with anxiety/depression** → mental health first aid, breathing exercises, when to seek help, crisis lines
- **An elderly person confused about medications** → "Tomo 3 pastillas pero no recuerdo cuáles" → medication tracking, interaction warnings
- **A parent asking about vaccines** → Peru's national vaccination schedule by age
- **Someone with diarrhea/respiratory infection** → ORS recipe, when it's serious, home remedies that work vs don't

**The key: ONE conversational agent that handles all of this naturally, not 10 separate "skills."**

### What It Should NOT Do (keep it simple):
- ❌ No complex medical diagnoses — always "consulta con tu médico"
- ❌ No prescription recommendations
- ❌ No 20 different skills — ONE agent that converses naturally
- ❌ No separate "nutrition skill" + "growth skill" — it's all one conversation
- ❌ No clinic management features (that's Phase 3)
- ❌ No replacing doctors — it's a knowledgeable health companion

## Superfoods Database (embed these, not 500 foods)

Priority iron-rich Peruvian foods the agent must know:

| Food | Iron (mg/100g) | Type | Cost | Key fact |
|------|---------------|------|------|----------|
| Sangrecita | 27.3 | Heme | S/2-5/kg | 10x more iron than chispitas |
| Hígado de pollo | 8.5 | Heme | S/8/kg | Most accessible organ meat |
| Bazo | 28.7 | Heme | S/5/kg | Highest iron organ meat |
| Cañihua | 12-15 | Non-heme | Local | Grows at 4000m altitude |
| Cushuro | 4.7-26 | Non-heme | Free | Grows wild in highlands |
| Quinua | 7.5-13 | Non-heme | S/8/kg | Widely available |
| Lentejas | 7.5 | Non-heme | S/6/kg | Cheap, available everywhere |
| Espinaca | 2.7 | Non-heme | S/3/atado | Combine with vitamin C |
| Camu camu | 2,780mg vit C | Enhancer | Local | Best vitamin C source on Earth |
| Huevo | 1.2 + protein | Mixed | S/0.50 | Daily staple |

## Absorption Rules (CRITICAL knowledge):
- Heme iron (animal) absorbs 15-35% — sangrecita, hígado, bazo
- Non-heme iron (plant) absorbs 2-20% — quinua, lentejas, espinaca
- Vitamin C DOUBLES non-heme absorption → always combine
- Tea/coffee/infusions BLOCK absorption 60-82% → NEVER with meals
- Calcium competes with iron → don't give milk WITH iron-rich meal
- Parasites steal iron → deworming every 6 months is essential

## Personas (15, covering full health spectrum):

### Childhood & Maternal (anemia spearhead)
1. **Lucía** (28, Lima) — toddler not gaining weight, worried about anemia, logs food + weight
2. **María** (22, rural Cusco) — first baby, what to feed at 6 months, complementary feeding
3. **Doña Carmen** (55, grandmother, Puno) — raising grandchildren, gives anise tea (needs gentle correction)
4. **Rosa** (19, pregnant, Ayacucho) — prenatal iron, nausea, warning signs to watch for
5. **Pedro** (35, father, Huancavelica) — "mi esposa dice que el bebé está pálido" → what to do

### Chronic Disease (NCDs = 73% of deaths)
6. **Carlos** (52, diabetic, Lima) — daily glucose tracking, what to eat, metformin questions
7. **Señora Marta** (60, hypertension, Arequipa) — blood pressure monitoring, low-salt Peruvian recipes
8. **Jorge** (45, overweight, truck driver) — "me siento cansado siempre" → screening questions, lifestyle changes

### Elderly Care (family caregivers)
9. **Miguel** (38, Lima) — "mi mamá tiene 72 años, le duele el pecho y toma 3 pastillas" → triage, medication tracking
10. **Abuela Juana** (68, Junín) — confused about her diabetes medications, forgets doses

### Mental Health (46% say #1 concern)
11. **Andrea** (23, university student, Lima) — anxiety, can't sleep, stress about exams
12. **Luis** (40, recently divorced, Trujillo) — feeling depressed, asks about help

### Acute/Emergency Triage
13. **Farmer José** (55, Cajamarca) — chest pain, remote area → emergency triage, what to do NOW
14. **Mother Sofía** (30, child has diarrhea+fever for 3 days) — when is it serious, ORS recipe

### Health Worker
15. **Nurse Rocío** (28, rural posta, Huancavelica) — quick growth screening for 20 children at a health fair

## Technical Architecture
Same as BLUEPRINT.md but simpler:
- ONE OpenClaw agent (not 10 skills)
- Embedded Peruvian food database (not external API dependency)
- WHO growth z-scores (embedded tables)
- Per-tenant encryption (health data is sensitive)
- WhatsApp via Baileys
- vLLM Qwen3.5-27B (same instance as yaya_platform)

## Disclaimer (always shown):
"🏥 Yaya Salud es un asistente informativo de nutrición. No reemplaza la consulta médica. Si tu hijo muestra signos de anemia severa (palidez extrema, fatiga, falta de apetito), acude al centro de salud más cercano."
