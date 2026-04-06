import type { University } from '../types.js';

const universities: Map<string, University> = new Map([
  [
    'fsu',
    {
      id: 'fsu',
      name: 'Florida State University',
      website: 'https://www.fsu.edu',
      location: 'Tallahassee, FL',
    },
  ],
  [
    'fiu',
    {
      id: 'fiu',
      name: 'Florida International University',
      website: 'https://www.fiu.edu',
      location: 'Miami, FL',
    },
  ],
]);

/**
 * Get a university by its ID.
 */
export function getUniversity(id: string): University | undefined {
  return universities.get(id.toLowerCase());
}

/**
 * List all indexed universities.
 */
export function listUniversities(): University[] {
  return Array.from(universities.values());
}
