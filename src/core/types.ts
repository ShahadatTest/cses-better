export type LanguageId =
  | 'cpp'
  | 'python'
  | 'java'
  | 'rust'
  | 'go'
  | 'javascript'
  | 'typescript'
  | 'c';

export interface LanguageConfig {
  id: LanguageId;
  name: string;
  pistonLanguage: string;
  pistonVersion: string;
  extension: string;
  monacoLanguage: string;
  defaultTemplate: string;
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isSample?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  user: string;
  userId?: string;
  language: string;
  score: string;
}

export interface ProblemStats {
  solvedBy: number;
  attemptedBy: number;
  successRate: string;
  fastest: LeaderboardEntry[];
  shortest: LeaderboardEntry[];
}

export interface Problem {
  id: string;
  title: string;
  category: string;
  timeLimit: string;
  memoryLimit: string;
  statementHtml: string;
  testCases: TestCase[];
  stats?: ProblemStats;
  constraints?: string[];
}

export interface Category {
  id: string;
  name: string;
  taskCount: number;
  problemIds: string[];
}

export type VerdictStatus =
  | 'AC'
  | 'WA'
  | 'TLE'
  | 'MLE'
  | 'CE'
  | 'RE'
  | 'RUNNING'
  | 'PAUSED'
  | 'IDLE'
  | 'SKIPPED';

/**
 * Maximum input size in bytes accepted by the OnlineCompiler.io cloud API.
 * Inputs exceeding this capacity are bypassed and marked as done/skipped to prevent HTTP 400 errors.
 */
export const MAX_COMPILER_INPUT_BYTES = 98 * 1024; // ~100 KB

export function isLargeInput(input?: string): boolean {
  if (!input) return false;
  return input.length > MAX_COMPILER_INPUT_BYTES;
}

export interface DiffResult {
  expectedLine: string;
  actualLine: string;
  lineIndex: number;
}

export interface TestResult {
  testCaseId: string;
  status: VerdictStatus;
  executionTimeMs: number;
  memoryBytes: number;
  actualOutput: string;
  expectedOutput: string;
  stderr?: string;
  diff?: DiffResult;
}

export interface SubmissionRecord {
  id: string;
  problemId: string;
  language: LanguageId;
  code: string;
  charCount: number;
  timestamp: number;
  status: VerdictStatus;
  passedCount: number;
  totalCount: number;
  maxTimeMs: number;
  maxMemoryBytes: number;
}

export interface ExecutionOptions {
  language: LanguageId;
  code: string;
  stdin?: string;
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface ExecutionResponse {
  output: string;
  stderr: string;
  exitCode: number;
  wallTimeMs: number;
  memoryBytes: number;
  status: 'success' | 'error';
  error?: string;
  signal?: string | null;
}

export interface NoteEntry {
  problemId: string;
  content: string;
  updatedAt?: number;
}

export interface UserDataExport {
  version: number;
  drafts: Record<string, string>;
  submissions: SubmissionRecord[];
  notes?: Record<string, string>;
  starredIds?: string[];
  exportedAt: number;
}

export interface AppSettings {
  apiKey: string;
  widgetKey?: string;
  compilerEndpoint: string;
  defaultEditor: 'monaco' | 'inbuilt';
  fontSize: number;
  tabSize: 2 | 4;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  apiKey: '',
  widgetKey: '',
  compilerEndpoint: '/api/compile',
  defaultEditor: 'monaco',
  fontSize: 14,
  tabSize: 4,
};

// --- Multi-Tenant Public User & Auth ---
export interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  provider?: 'google' | 'github' | 'guest';
  csesNick?: string;
  createdAt?: string;
}

// --- CSES Remote Submission & Verdicts ---
export interface CsesCredentials {
  nick: string;
  userId?: string;
  pass: string;
  remember?: boolean;
  sessionCookie?: string;
  lastSyncedAt?: number;
}

export interface StoredCsesAccount {
  nick: string;
  pass?: string;
  userId?: string;
  sessionCookie?: string;
  lastSyncedAt?: number;
  remember: boolean;
  solvedCount?: number;
}

export interface CsesSubmissionSummary {
  id: string;
  user?: string;
  userId?: string;
  time: string;
  language: string;
  runtime?: string;
  size?: string;
  status: string;
  resultUrl: string;
}

export interface CsesSubmitPayload {
  nick?: string;
  pass?: string;
  problemId: string;
  language: LanguageId;
  code: string;
  useDefaultBot?: boolean;
}

export interface CsesSubmitResponse {
  success: boolean;
  submissionId?: string;
  resultUrl?: string;
  problemId?: string;
  sessionCookie?: string;
  error?: string;
}

export interface CsesTestDetail {
  index: number;
  verdict: string;
  time: string;
}

export interface CsesVerdictResult {
  submissionId: string;
  status: 'PENDING' | 'TESTING' | 'ACCEPTED' | 'WRONG ANSWER' | 'TIME LIMIT EXCEEDED' | 'COMPILE ERROR' | 'OUTPUT LIMIT EXCEEDED' | 'RUNTIME ERROR' | 'UNKNOWN';
  rawStatusText: string;
  totalTime?: string;
  totalMemory?: string;
  compilerOutput?: string;
  code?: string;
  language?: string;
  tests: CsesTestDetail[];
  resultUrl: string;
  problemId?: string;
  timestamp?: number;
}

// --- Official CSES User Profile ---
export interface CsesUserProfile {
  nick: string;
  userId?: string;
  name?: string;
  rank?: string;
  submissionCount?: number;
  firstSubmission?: string;
  lastSubmission?: string;
  languages?: { language: string; submissions: number; share: string }[];
  solvedCount: number;
  solvedProblems: { id: string; name: string }[];
  country?: string;
  registeredDate?: string;
  officialUrl: string;
}

// --- Continuous CSES Archive ---
export interface CsesArchiveEntry {
  problemId: string;
  title: string;
  category: string;
  timeLimit: string;
  memoryLimit: string;
  solvedBy: number;
  attemptedBy: number;
  successRate: string;
  fastest: LeaderboardEntry[];
  shortest: LeaderboardEntry[];
  lastUpdated: string;
}


