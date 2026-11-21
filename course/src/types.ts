export type EnglishLevel = 'A' | 'B' | 'X' | 'II' | 'III' | 'IV' | 'V' | 'VI'

export interface Course {
  id: string
  name: string
  aliases: string[]
  codes: string[]
  credits: number
  creditsLabel: string
  semester: string
  modules: string[]
  groups: string[]
  majors: string[]
  electiveGroups?: number[]
  electiveKind?: 'limited' | 'free'
  electiveOfferings?: { group: number; credits: number; semester: string }[]
  englishTerms?: Partial<Record<EnglishLevel, string>>
  creditPool?: 'civic-optional' | 'sports-core' | 'sports-specialty' | 'art'
}

export type ElectiveRule = { groups: number[]; minimum: number; unit: '门' | '学分' }
export type ElectivePlan = {
  limitedCredits: number
  freeCredits: number
  limited: ElectiveRule[]
  practice?: { credits: number; rules: ElectiveRule[] }
  supplement?: { groups: number[]; label: string }
  groupNames?: Record<number, string>
}

export interface CourseCatalog {
  courses: Course[]
  electivePlan: ElectivePlan
  recordsCatalog: Pick<Course, 'id' | 'name' | 'codes' | 'creditsLabel'>[]
}

export type PassStatus = 'passed' | 'failed' | 'unknown'
export type MatchType = 'code' | 'name' | 'manual' | ''

export interface TranscriptRow {
  id: string
  rawName: string
  code: string
  score: string
  credits: string
  semester: string
  matchId: string
  matchType: MatchType
  passStatus: PassStatus
  selected: boolean
  issue: string
}

export interface CompletedRecord {
  courseId: string
  score: string
  source: '成绩单导入' | '手动标记'
  importedAt: string
  fileName?: string
}
