import type { Course } from '../types.js';

/**
 * In-memory course catalog seeded with FSU Computer Science courses.
 * Keyed by `${universityId}:${courseCode}` for fast lookup.
 */
const courseCatalog: Map<string, Course> = new Map();

// ── FSU CS Course Seed Data ────────────────────────────────

const fsuCourses: Course[] = [
  // ── Foundation ──────────────────────────────────────
  {
    code: 'MAC2311',
    title: 'Calculus 1',
    description: 'Limits, derivatives, integrals, and the Fundamental Theorem of Calculus.',
    credits: 4,
    prerequisites: [],
    corequisites: [],
    department: 'Mathematics',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'MAC2312',
    title: 'Calculus 2',
    description: 'Techniques of integration, sequences, series, and polar coordinates.',
    credits: 4,
    prerequisites: ['MAC2311'],
    corequisites: [],
    department: 'Mathematics',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'COP3014',
    title: 'Programming I',
    description: 'Introduction to programming concepts using C++. Variables, control structures, functions, arrays, and basic OOP.',
    credits: 3,
    prerequisites: [],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'COP3330',
    title: 'Object-Oriented Programming',
    description: 'Object-oriented design and programming using C++ and Java. Classes, inheritance, polymorphism, templates.',
    credits: 3,
    prerequisites: ['COP3014'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'COT3100',
    title: 'Computational Structures',
    description: 'Discrete mathematics for CS: logic, sets, relations, functions, combinatorics, graph theory, and proof techniques.',
    credits: 3,
    prerequisites: ['MAC2312'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'STA3032',
    title: 'Applied Statistics for Engineers and Scientists',
    description: 'Probability, random variables, distributions, estimation, hypothesis testing, and regression.',
    credits: 3,
    prerequisites: ['MAC2312'],
    corequisites: [],
    department: 'Statistics',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },

  // ── Core CS ──────────────────────────────────────
  {
    code: 'COP4530',
    title: 'Data Structures, Algorithms, and Generic Programming',
    description: 'Lists, stacks, queues, trees, hash tables, graphs, sorting, and algorithm analysis. Generic programming with templates.',
    credits: 3,
    prerequisites: ['COP3330', 'COT3100'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'COP4610',
    title: 'Operating Systems',
    description: 'Process management, memory management, file systems, I/O, concurrency, and distributed systems concepts.',
    credits: 3,
    prerequisites: ['COP4530'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'CDA3100',
    title: 'Computer Organization I',
    description: 'Digital logic, assembly language, computer arithmetic, CPU organization, memory hierarchy.',
    credits: 3,
    prerequisites: ['COP3014'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'CDA3101',
    title: 'Computer Organization II',
    description: 'Advanced CPU design, pipelining, cache design, virtual memory, multiprocessor systems.',
    credits: 3,
    prerequisites: ['CDA3100'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'COT4420',
    title: 'Theory of Computation',
    description: 'Finite automata, regular expressions, context-free grammars, Turing machines, decidability, and complexity.',
    credits: 3,
    prerequisites: ['COT3100', 'COP4530'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'COP4020',
    title: 'Programming Languages',
    description: 'Language design, syntax, semantics, type systems, functional and logic programming paradigms.',
    credits: 3,
    prerequisites: ['COP4530'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },

  // ── Security Track ──────────────────────────────────────
  {
    code: 'CIS4360',
    title: 'Introduction to Computer Security',
    description: 'Security principles, cryptography, access control, network security, and security policy.',
    credits: 3,
    prerequisites: ['COP4530'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'CIS4362',
    title: 'Advanced Computer Security',
    description: 'Advanced cryptographic protocols, secure system design, intrusion detection, and formal verification.',
    credits: 3,
    prerequisites: ['CIS4360'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'CIS4604',
    title: 'Ethical Hacking and Penetration Testing',
    description: 'Ethical hacking methodologies, vulnerability assessment, penetration testing tools and techniques.',
    credits: 3,
    prerequisites: ['CIS4360'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },

  // ── Data Science Track ──────────────────────────────────────
  {
    code: 'CAP4770',
    title: 'Introduction to Data Mining',
    description: 'Data preprocessing, classification, clustering, association rules, and evaluation methods.',
    credits: 3,
    prerequisites: ['COP4530', 'STA3032'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'CAP4773',
    title: 'Advanced Data Mining',
    description: 'Deep learning, text mining, graph mining, recommender systems, and advanced analytics.',
    credits: 3,
    prerequisites: ['CAP4770'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },

  // ── Additional CS Electives ──────────────────────────────────────
  {
    code: 'COP4710',
    title: 'Database Systems',
    description: 'Relational model, SQL, normalization, query optimization, transaction processing, and NoSQL.',
    credits: 3,
    prerequisites: ['COP4530'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'CNT4504',
    title: 'Computer Networks and Distributed Systems',
    description: 'Network protocols, TCP/IP, routing, socket programming, and distributed computing.',
    credits: 3,
    prerequisites: ['COP4610'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'CAP4630',
    title: 'Introduction to Artificial Intelligence',
    description: 'Search algorithms, game playing, knowledge representation, planning, and machine learning fundamentals.',
    credits: 3,
    prerequisites: ['COP4530', 'STA3032'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'CEN4020',
    title: 'Software Engineering',
    description: 'Software development lifecycle, requirements, design patterns, testing, and project management.',
    credits: 3,
    prerequisites: ['COP4530'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'COP4521',
    title: 'Secure, Parallel, and Distributed Computing with Python',
    description: 'Python for parallel computing, network security applications, and distributed systems.',
    credits: 3,
    prerequisites: ['COP4530', 'CIS4360'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
  {
    code: 'COP4656',
    title: 'Mobile Programming',
    description: 'Mobile application development for iOS and Android platforms, UI design, and mobile-specific patterns.',
    credits: 3,
    prerequisites: ['COP3330'],
    corequisites: [],
    department: 'Computer Science',
    college: 'College of Arts and Sciences',
    level: 'undergraduate',
    universityId: 'fsu',
  },
];

// Populate the catalog
for (const course of fsuCourses) {
  courseCatalog.set(`${course.universityId}:${course.code}`, course);
}

/**
 * Search courses by code prefix, title keyword, or department.
 */
export function searchCourses(
  query: string,
  universityId?: string,
): Course[] {
  const q = query.toLowerCase();
  const results: Course[] = [];

  for (const course of courseCatalog.values()) {
    if (universityId && course.universityId !== universityId.toLowerCase()) {
      continue;
    }

    const codeMatch = course.code.toLowerCase().includes(q);
    const titleMatch = course.title.toLowerCase().includes(q);
    const deptMatch = course.department.toLowerCase().includes(q);

    if (codeMatch || titleMatch || deptMatch) {
      results.push(course);
    }
  }

  return results;
}

/**
 * Get a specific course by code and university ID.
 */
export function getCourse(
  code: string,
  universityId: string = 'fsu',
): Course | undefined {
  return courseCatalog.get(`${universityId.toLowerCase()}:${code.toUpperCase()}`);
}

/**
 * Get the direct prerequisites for a course.
 */
export function getPrerequisites(
  code: string,
  universityId: string = 'fsu',
): string[] {
  const course = getCourse(code, universityId);
  return course?.prerequisites ?? [];
}

/**
 * Get all courses in the catalog for a given university.
 */
export function getAllCourses(universityId?: string): Course[] {
  const results: Course[] = [];
  for (const course of courseCatalog.values()) {
    if (!universityId || course.universityId === universityId.toLowerCase()) {
      results.push(course);
    }
  }
  return results;
}
