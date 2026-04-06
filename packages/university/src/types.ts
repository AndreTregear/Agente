export interface University {
  id: string;           // 'fsu', 'fiu'
  name: string;
  website: string;
  location: string;
}

export interface Course {
  code: string;          // 'COP4530'
  title: string;         // 'Data Structures'
  description: string;
  credits: number;
  prerequisites: string[];   // ['COP3330', 'COT3100']
  corequisites: string[];
  department: string;
  college: string;
  level: 'undergraduate' | 'graduate';
  universityId: string;
}

export interface Section {
  courseCode: string;
  term: string;          // 'Fall 2026'
  sectionNumber: string;
  instructor: string;
  schedule: string;      // 'MWF 10:00-10:50'
  location: string;
  seatsTotal: number;
  seatsAvailable: number;
  deliveryMode: 'in-person' | 'online' | 'hybrid';
}

export interface Professor {
  name: string;
  department: string;
  universityId: string;
  rating?: number;
  difficulty?: number;
  wouldTakeAgain?: number;
}

export interface PrerequisiteCheckResult {
  course: string;
  completedCourses: string[];
  missingPrereqs: string[];
  eligible: boolean;
  confidence: number;
  votes: VoteResult[];
}

export interface VoteResult {
  agentId: number;
  vote: 'PASS' | 'FAIL' | 'UNCERTAIN';
  reasoning: string;
  latencyMs: number;
}
