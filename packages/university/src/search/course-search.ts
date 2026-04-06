import { getAllCourses, searchCourses as catalogSearch } from '../data/courses.js';
import type { Course } from '../types.js';

export interface SearchOptions {
  universityId?: string;
  department?: string;
  level?: 'undergraduate' | 'graduate';
  limit?: number;
}

export interface SearchResult {
  course: Course;
  relevance: number;
}

/**
 * Search courses by code prefix, title keyword, or department.
 * Returns results sorted by relevance score (higher = better match).
 */
export function searchCourses(
  query: string,
  options: SearchOptions = {},
): SearchResult[] {
  const { universityId, department, level, limit = 20 } = options;
  const q = query.toLowerCase().trim();

  if (!q) {
    // Empty query: return all courses for the given university
    const all = getAllCourses(universityId);
    return all
      .filter((c) => {
        if (department && c.department.toLowerCase() !== department.toLowerCase()) return false;
        if (level && c.level !== level) return false;
        return true;
      })
      .slice(0, limit)
      .map((course) => ({ course, relevance: 0.5 }));
  }

  // Get base matches from catalog
  const matches = catalogSearch(q, universityId);

  // Score and filter
  const scored: SearchResult[] = matches
    .filter((c) => {
      if (department && c.department.toLowerCase() !== department.toLowerCase()) return false;
      if (level && c.level !== level) return false;
      return true;
    })
    .map((course) => {
      let relevance = 0;

      // Exact code match
      if (course.code.toLowerCase() === q) {
        relevance += 1.0;
      }
      // Code prefix match
      else if (course.code.toLowerCase().startsWith(q)) {
        relevance += 0.8;
      }
      // Code contains
      else if (course.code.toLowerCase().includes(q)) {
        relevance += 0.6;
      }

      // Title exact word match
      const titleWords = course.title.toLowerCase().split(/\s+/);
      if (titleWords.includes(q)) {
        relevance += 0.7;
      }
      // Title contains
      else if (course.title.toLowerCase().includes(q)) {
        relevance += 0.4;
      }

      // Department match
      if (course.department.toLowerCase().includes(q)) {
        relevance += 0.3;
      }

      // Description match (lower weight)
      if (course.description.toLowerCase().includes(q)) {
        relevance += 0.1;
      }

      return { course, relevance };
    });

  // Sort by relevance descending, then by code alphabetically
  scored.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return a.course.code.localeCompare(b.course.code);
  });

  return scored.slice(0, limit);
}
