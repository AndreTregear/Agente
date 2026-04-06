// ── Types ────────────────────────────────────
export type {
  University,
  Course,
  Section,
  Professor,
  PrerequisiteCheckResult,
  VoteResult,
} from './types.js';

// ── Data ────────────────────────────────────
export { getUniversity, listUniversities } from './data/universities.js';
export {
  searchCourses as catalogSearchCourses,
  getCourse,
  getPrerequisites,
  getAllCourses,
} from './data/courses.js';

// ── Validation ────────────────────────────────────
export { checkPrerequisites } from './validation/prerequisite-checker.js';

// ── Search ────────────────────────────────────
export { searchCourses } from './search/course-search.js';
export type { SearchOptions, SearchResult } from './search/course-search.js';
