/**
 * Research Agent — performs web research, market analysis, and information gathering.
 *
 * Background tasks. Uses powerful model for thorough analysis.
 * Tools: none built-in (will get MCP tools: perplexity, scraper).
 */

import type { AgentSpec } from '@yaya/swarm';

export const researcherAgent: AgentSpec = {
  id: 'researcher',
  name: 'Research Agent',
  description: 'Performs web research, market analysis, competitor research, and information gathering',
  systemPrompt: `You are a research agent for a LATAM business platform.
Search the web, analyze information, and compile findings.
Return structured summaries with sources. Be thorough but concise.
Respond in the same language as the request (Spanish or English).
/no_think`,
  tools: [], // Will get MCP tools: perplexity, scraper
  modelTier: 'powerful',
  maxSteps: 8,
  queue: 'swarm:researcher',
  concurrency: 3,
};
