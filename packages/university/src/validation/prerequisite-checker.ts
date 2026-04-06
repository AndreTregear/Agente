import { getCourse, getPrerequisites } from '../data/courses.js';
import type { PrerequisiteCheckResult, VoteResult } from '../types.js';

// ── Configuration ────────────────────────────────────

const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000/v1';
const VLLM_API_KEY = process.env.VLLM_API_KEY || '';
const VLLM_MODEL = process.env.VLLM_MODEL || 'qwen3.5-27b';

// ── Deterministic Check ────────────────────────────────────

/**
 * Deterministic prerequisite check against the in-memory course catalog.
 * Returns { eligible, missingPrereqs } without any LLM calls.
 */
function deterministicCheck(
  courseCode: string,
  completedCourses: string[],
  universityId: string,
): { eligible: boolean; missingPrereqs: string[] } {
  const prereqs = getPrerequisites(courseCode, universityId);
  const completedSet = new Set(completedCourses.map((c) => c.toUpperCase()));
  const missingPrereqs = prereqs.filter((p) => !completedSet.has(p.toUpperCase()));

  return {
    eligible: missingPrereqs.length === 0,
    missingPrereqs,
  };
}

// ── Multi-Agent Voting (Port of CampusGenie) ────────────────────

/**
 * Call the vLLM OpenAI-compatible API with a specific seed for agent diversity.
 */
async function callAgent(
  prompt: string,
  agentId: number,
  seed: number,
): Promise<VoteResult> {
  const start = Date.now();

  try {
    const response = await fetch(`${VLLM_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(VLLM_API_KEY ? { Authorization: `Bearer ${VLLM_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: VLLM_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a university course prerequisite validator. Answer with PASS, FAIL, or UNCERTAIN followed by a brief reason.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 100,
        seed,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`vLLM API ${response.status}: ${text}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? '';

    // Parse vote from response
    const upper = content.toUpperCase();
    let vote: 'PASS' | 'FAIL' | 'UNCERTAIN' = 'UNCERTAIN';
    if (upper.includes('PASS')) {
      vote = 'PASS';
    } else if (upper.includes('FAIL')) {
      vote = 'FAIL';
    }

    return {
      agentId,
      vote,
      reasoning: content.slice(0, 200),
      latencyMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      agentId,
      vote: 'UNCERTAIN',
      reasoning: `Agent error: ${message}`,
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Multi-agent voting: run N agents in parallel with different seeds,
 * then tally consensus. Port of CampusGenie's vote_on_task().
 */
async function multiAgentVote(
  prompt: string,
  agentCount: number = 4,
): Promise<{ consensus: 'PASS' | 'FAIL' | 'UNCERTAIN'; confidence: number; votes: VoteResult[] }> {
  // Run all agents in parallel
  const votePromises = Array.from({ length: agentCount }, (_, i) =>
    callAgent(prompt, i + 1, 42 + i),
  );
  const votes = await Promise.all(votePromises);

  // Tally votes
  const counts: Record<string, number> = { PASS: 0, FAIL: 0, UNCERTAIN: 0 };
  for (const v of votes) {
    counts[v.vote]++;
  }

  // Find consensus (most common vote)
  let consensus: 'PASS' | 'FAIL' | 'UNCERTAIN' = 'UNCERTAIN';
  let maxCount = 0;
  for (const [vote, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      consensus = vote as 'PASS' | 'FAIL' | 'UNCERTAIN';
    }
  }

  const confidence = maxCount / agentCount;

  return { consensus, confidence, votes };
}

// ── Main Prerequisite Checker ────────────────────────────────────

/**
 * Check whether a student meets the prerequisites for a course.
 *
 * 1. Performs a deterministic check against the course catalog.
 * 2. If the result is unambiguous, returns immediately (no LLM calls).
 * 3. For ambiguous cases (course not found in catalog), uses multi-agent voting.
 */
export async function checkPrerequisites(
  courseCode: string,
  completedCourses: string[],
  universityId: string = 'fsu',
): Promise<PrerequisiteCheckResult> {
  const course = getCourse(courseCode, universityId);

  // If the course exists in our catalog, do a deterministic check
  if (course) {
    const { eligible, missingPrereqs } = deterministicCheck(
      courseCode,
      completedCourses,
      universityId,
    );

    return {
      course: courseCode,
      completedCourses,
      missingPrereqs,
      eligible,
      confidence: 1.0, // Deterministic = 100% confidence
      votes: [], // No LLM voting needed
    };
  }

  // Course not in catalog — use multi-agent voting for ambiguous case
  const prompt = `Task: Prerequisite verification

Course: ${courseCode}
University: ${universityId.toUpperCase()}
Student's completed courses: [${completedCourses.join(', ')}]

Based on typical CS curriculum prerequisites, does this student likely meet the prerequisites for ${courseCode}?
Answer with PASS if likely eligible, FAIL if likely not eligible, or UNCERTAIN if unclear.`;

  const { consensus, confidence, votes } = await multiAgentVote(prompt);

  return {
    course: courseCode,
    completedCourses,
    missingPrereqs: consensus === 'FAIL' ? [`Unknown prerequisites for ${courseCode}`] : [],
    eligible: consensus === 'PASS',
    confidence,
    votes,
  };
}

// ── Self-test (run with: node --loader ts-node/esm src/validation/prerequisite-checker.ts) ──

async function selfTest() {
  console.log('='.repeat(70));
  console.log('  Prerequisite Checker — Self-Test');
  console.log('='.repeat(70));

  const testCases = [
    {
      name: 'CIS4362: has CIS4360 (should PASS)',
      courseCode: 'CIS4362',
      completed: ['COP4530', 'CIS4360', 'CAP4770'],
      expectedEligible: true,
    },
    {
      name: 'CAP4773: missing CAP4770 (should FAIL)',
      courseCode: 'CAP4773',
      completed: ['COP4530', 'CIS4360'],
      expectedEligible: false,
    },
    {
      name: 'COP4610: has COP4530 (should PASS)',
      courseCode: 'COP4610',
      completed: ['COP4530', 'COT3100'],
      expectedEligible: true,
    },
    {
      name: 'CIS4604: missing CIS4360 (should FAIL)',
      courseCode: 'CIS4604',
      completed: ['COP4530'],
      expectedEligible: false,
    },
    {
      name: 'CAP4770: has COP4530 + STA3032 (should PASS)',
      courseCode: 'CAP4770',
      completed: ['COP4530', 'STA3032'],
      expectedEligible: true,
    },
    {
      name: 'COP4530: missing COT3100 (should FAIL)',
      courseCode: 'COP4530',
      completed: ['COP3330'],
      expectedEligible: false,
    },
    {
      name: 'MAC2311: no prereqs (should PASS)',
      courseCode: 'MAC2311',
      completed: [],
      expectedEligible: true,
    },
  ];

  let passed = 0;

  for (const tc of testCases) {
    const result = await checkPrerequisites(tc.courseCode, tc.completed, 'fsu');
    const ok = result.eligible === tc.expectedEligible;
    passed += ok ? 1 : 0;

    const status = ok ? 'PASS' : 'FAIL';
    console.log(`\n  [${status}] ${tc.name}`);
    console.log(`    Eligible: ${result.eligible}, Confidence: ${result.confidence}`);
    if (result.missingPrereqs.length > 0) {
      console.log(`    Missing: ${result.missingPrereqs.join(', ')}`);
    }
    if (result.votes.length > 0) {
      console.log(`    Votes: ${result.votes.map((v) => v.vote).join(', ')}`);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`  Results: ${passed}/${testCases.length} passed`);
  console.log('='.repeat(70));
}

// Run self-test if executed directly
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('prerequisite-checker.ts') ||
    process.argv[1].endsWith('prerequisite-checker.js'));

if (isMainModule) {
  selfTest().catch(console.error);
}
