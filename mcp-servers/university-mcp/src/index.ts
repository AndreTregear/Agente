#!/usr/bin/env node
/**
 * University MCP Server
 * Exposes university course catalog, search, and prerequisite validation as MCP tools.
 *
 * Tools:
 *  - search_courses: Search courses by code, title, or department
 *  - get_course_details: Get full course info including prerequisites
 *  - check_prerequisites: Check if a student meets prerequisites for a course
 *  - list_universities: List all indexed universities
 *  - get_prerequisites_tree: Get full prerequisite chain for a course
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  searchCourses,
  getCourse,
  checkPrerequisites,
  listUniversities,
  getPrerequisites,
} from "@yaya/university";
import type { Course } from "@yaya/university";

// ── Tool Definitions ─────────────────────────────────

const TOOLS = [
  {
    name: "search_courses",
    description:
      "Search university courses by code, title, or department. Returns matching courses with basic info.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search term (matches against course code, title, or department)",
        },
        university: {
          type: "string",
          description: "University ID filter (e.g., 'fsu', 'fiu'). Optional.",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_course_details",
    description:
      "Get full details for a specific course including description, prerequisites, corequisites, and credits.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "Course code (e.g., 'COP4530')",
        },
        university: {
          type: "string",
          description: "University ID (default: 'fsu')",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "check_prerequisites",
    description:
      "Check if a student meets the prerequisites for a course based on their completed coursework. Uses deterministic catalog check and falls back to multi-agent AI voting for ambiguous cases.",
    inputSchema: {
      type: "object" as const,
      properties: {
        courseCode: {
          type: "string",
          description: "Target course code (e.g., 'COP4530')",
        },
        completedCourses: {
          type: "array",
          items: { type: "string" },
          description:
            "List of course codes the student has completed (e.g., ['COP3330', 'COT3100'])",
        },
        university: {
          type: "string",
          description: "University ID (default: 'fsu')",
        },
      },
      required: ["courseCode", "completedCourses"],
    },
  },
  {
    name: "list_universities",
    description: "List all indexed universities with their basic info.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_prerequisites_tree",
    description:
      "Get the full prerequisite chain for a course as a nested tree. Shows all direct and transitive prerequisites.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "Course code (e.g., 'COP4530')",
        },
        university: {
          type: "string",
          description: "University ID (default: 'fsu')",
        },
      },
      required: ["code"],
    },
  },
];

// ── Prerequisite Tree Builder ─────────────────────────────────

interface PrereqTreeNode {
  code: string;
  title: string;
  prerequisites: PrereqTreeNode[];
}

function buildPrereqTree(
  code: string,
  universityId: string,
  visited: Set<string> = new Set(),
): PrereqTreeNode | null {
  if (visited.has(code)) {
    return { code, title: "(circular reference)", prerequisites: [] };
  }
  visited.add(code);

  const course = getCourse(code, universityId);
  if (!course) {
    return { code, title: "(not in catalog)", prerequisites: [] };
  }

  const children: PrereqTreeNode[] = [];
  for (const prereqCode of course.prerequisites) {
    const child = buildPrereqTree(prereqCode, universityId, new Set(visited));
    if (child) {
      children.push(child);
    }
  }

  return {
    code: course.code,
    title: course.title,
    prerequisites: children,
  };
}

// ── Tool Handlers ─────────────────────────────────

async function handleTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "search_courses": {
      const query = args.query as string;
      const university = args.university as string | undefined;
      const limit = (args.limit as number) || 10;

      const results = searchCourses(query, { universityId: university, limit });

      return results.map((r) => ({
        code: r.course.code,
        title: r.course.title,
        credits: r.course.credits,
        prerequisites: r.course.prerequisites,
        department: r.course.department,
        relevance: Math.round(r.relevance * 100) / 100,
      }));
    }

    case "get_course_details": {
      const code = args.code as string;
      const university = (args.university as string) || "fsu";

      const course = getCourse(code, university);
      if (!course) {
        throw new Error(
          `Course ${code} not found at ${university.toUpperCase()}`,
        );
      }
      return course;
    }

    case "check_prerequisites": {
      const courseCode = args.courseCode as string;
      const completedCourses = args.completedCourses as string[];
      const university = (args.university as string) || "fsu";

      const result = await checkPrerequisites(
        courseCode,
        completedCourses,
        university,
      );

      return {
        eligible: result.eligible,
        missingPrereqs: result.missingPrereqs,
        confidence: result.confidence,
        votes: result.votes.map((v) => ({
          agentId: v.agentId,
          vote: v.vote,
          reasoning: v.reasoning,
          latencyMs: v.latencyMs,
        })),
      };
    }

    case "list_universities": {
      const unis = listUniversities();
      return unis.map((u) => ({
        id: u.id,
        name: u.name,
        location: u.location,
        website: u.website,
      }));
    }

    case "get_prerequisites_tree": {
      const code = args.code as string;
      const university = (args.university as string) || "fsu";

      const tree = buildPrereqTree(code, university);
      if (!tree) {
        throw new Error(
          `Course ${code} not found at ${university.toUpperCase()}`,
        );
      }
      return tree;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── MCP Server Setup ─────────────────────────────────

const server = new Server(
  { name: "university-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleTool(name, (args as Record<string, unknown>) ?? {});
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ── Main ─────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("University MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
