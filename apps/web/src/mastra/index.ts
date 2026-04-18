/**
 * Mastra instance — central registry for all agents, tools, and storage.
 *
 * v2: 9 agents (direct + supervisor + 7 workers) covering the full
 * business platform: metrics, scheduling, messaging, research,
 * email, calendar, meetings.
 */

import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { directAgent, supervisorAgent } from "./agents/ceo";
import {
  metricsAgent,
  schedulingAgent,
  messagingAgent,
  researchAgent,
  emailAgent,
  calendarAgent,
  meetingAgent,
} from "./agents/workers";

const storage = new PostgresStore({
  id: "yaya-store",
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://yaya_prod:yaya_s3cur3_db_2024!@localhost:5432/yaya_business",
});

export const mastra = new Mastra({
  storage,
  agents: {
    directAgent,
    supervisorAgent,
    metricsAgent,
    schedulingAgent,
    messagingAgent,
    researchAgent,
    emailAgent,
    calendarAgent,
    meetingAgent,
  },
});

export { directAgent, supervisorAgent } from "./agents/ceo";
export {
  metricsAgent,
  schedulingAgent,
  messagingAgent,
  researchAgent,
  emailAgent,
  calendarAgent,
  meetingAgent,
} from "./agents/workers";
