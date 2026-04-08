# Phase 3 — Deep Rural Health Access

## Overview
Phase 3 expands Yaya Salud from a general health companion into a specialized tool for Peru's hardest-to-reach communities. Focus: Andes (Puno, Huancavelica, Cajamarca) and Amazon (Loreto, Condorcanqui, Junín).

## Key Stats Driving Design
- 59.1% of rural communities have NO health facility
- 54% of indigenous communities >1hr from clinic (15% are >8hrs)
- Maternal mortality 2.5x higher in poorest regions
- TB incidence in Loreto: 164/100k (higher than Lima)
- Mobile phones: 84.7% rural penetration
- WhatsApp: zero-rated (FREE) on all Peruvian carriers
- Quechua speakers: ~4M, health materials almost exclusively in Spanish

## Modules

### Module A: Quechua Language Support
- Bilingual Spanish/Quechua responses for core health topics
- Quechua greeting detection and response
- Medical term glossary (Quechua ↔ Spanish)
- Voice-friendly: short sentences, oral-tradition-aware phrasing
- Embedded Quechua health phrases (prenatal, nutrition, danger signs, TB)
- Tests: Quechua input detection, bilingual response generation, glossary lookup

### Module B: Maternal Health Deep-Dive
- Prenatal care tracker (week-by-week guidance)
- Danger sign recognition (hemorrhage, pre-eclampsia, infection)
- Birth plan helper (nearest facility, transport plan, emergency contacts)
- Postpartum monitoring (bleeding, fever, mood)
- Partner/family education ("three delays" prevention)
- Integration with existing growth tracker for newborn follow-up
- Personas: Rosa (pregnant, Ayacucho), María (first baby, Cusco), partner Pedro
- Tests: danger sign classification, gestational week calculation, birth plan generation

### Module C: TB Screening & Adherence
- Symptom screening questionnaire (cough >2 weeks, weight loss, night sweats, fever)
- Risk assessment (contact with TB patient, HIV status, crowded housing)
- Treatment adherence reminders (DOTS-compatible daily reminders)
- Myth-busting (traditional remedies: which are safe alongside treatment, which interfere)
- MDR-TB awareness (importance of completing full course)
- Regional referral info (nearest facility with TB diagnostic capability)
- Personas: new TB personas for Amazon/Andes contexts
- Tests: symptom scoring, risk classification, reminder scheduling

### Module D: Health Worker Clinical Decision Support
- Quick screening protocols (child growth, TB, malaria, dengue, pre-eclampsia)
- Differential diagnosis helper ("child presents with fever + rash + joint pain")
- Drug interaction checker (common rural pharmacy stock)
- Batch screening mode (health fair: process multiple patients quickly)
- SERUMS doctor field reference (what to expect in rural posting)
- Emergency stabilization protocols (hemorrhage, seizure, severe dehydration)
- Integration with Nurse Rocío persona (expanded)
- Tests: differential diagnosis accuracy, protocol completeness, batch mode

### Module E: Emergency Triage Enhancement
- "Three delays" intervention (decision → transport → treatment)
- Severity classification (green/yellow/red/black)
- Region-aware nearest facility lookup (embedded data for major departments)
- Transport guidance (what to do during multi-hour journey)
- Traditional remedy safety checker (safe alongside, harmful, neutral)
- ORS recipe and preparation guidance
- Water purification methods
- Tests: severity classification, facility lookup, remedy safety check

## Technical Constraints
- All responses must work on 2G / low bandwidth
- Max response length: 500 chars for critical alerts, 1000 chars for guidance
- No external API dependencies for core functionality (everything embedded)
- Quechua support: embedded phrase database, not machine translation
- All medical guidance includes disclaimer and "consulta con tu médico"

## Success Criteria
- All existing 113 tests continue passing
- Each module adds minimum 20 tests
- 5 new personas (TB patient, Quechua-speaking mother, health worker expanded, Amazon family, emergency scenario)
- Total test count target: 200+
