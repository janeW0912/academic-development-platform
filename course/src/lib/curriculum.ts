import type { Course, EnglishLevel } from '../types'

export const ENGLISH_LEVELS = {
  A: '普通班 A 级',
  B: '普通班 B 级',
  X: '实验班',
} as const

export const ENGLISH_LEVELS_2025 = { III: 'Ⅲ级', IV: 'Ⅳ级', V: 'Ⅴ级', VI: 'Ⅵ级' } as const
export const ENGLISH_LEVELS_2026 = { III: '6 学分', V: '4 学分', VI: '2 学分' } as const
export const ENGLISH_CREDITS_2025: Partial<Record<EnglishLevel, number>> = { II: 6, III: 6, IV: 6, V: 4, VI: 2 }

export const ENGLISH_FOUNDATION = '基础技能 - 公共外语'
export const ENGLISH_ELECTIVES = '公共外语拓展课'
export const PUBLIC_ENGLISH = '公共外语'

export function displayModuleName(moduleName: string) {
  return moduleName === ENGLISH_FOUNDATION || moduleName === ENGLISH_ELECTIVES ? PUBLIC_ENGLISH : moduleName
}

// IDs refer to the existing course catalogue, including the entries without course codes.
const ENGLISH_COURSES = {
  A: ['C0017', 'C0018', 'C0019', 'C0031', 'C0032', 'C0033', 'C0034', 'C0035', 'C0036'],
  B: ['C0020', 'C0018', 'C0019', 'C0031', 'C0032', 'C0033', 'C0034', 'C0035', 'C0036'],
  X: ['C0027', 'C0019', 'C0028', 'C0029', 'C0030', 'C0037', 'C0038', 'C0039', 'C0040', 'C0041'],
}

export function selectEnglishCourse(course: Course, level: EnglishLevel): Course[] {
  const english = course.modules.includes(ENGLISH_FOUNDATION) || course.modules.includes(ENGLISH_ELECTIVES)
  if (!english) return [course]
  if (course.englishTerms) {
    const semester = course.englishTerms[level]
    return semester ? [{ ...course, semester }] : []
  }
  const englishId = course.id
  if (!(level === 'A' || level === 'B' || level === 'X') || !ENGLISH_COURSES[level].includes(englishId)) return []
  if (englishId === 'C0018' || englishId === 'C0030') {
    return [{ ...course, modules: [ENGLISH_ELECTIVES] }]
  }
  if (englishId === 'C0019' && level === 'X') return [{ ...course, semester: '1' }]
  return [course]
}

export function matchesSemester(course: Course, semester: number) {
  return semester === 0 || course.semester.split(/[,，]/).some((value) => value.trim() === String(semester))
}

export function semesterLabel(cohort: number, semester: number) {
  const year = cohort + Math.floor(semester / 2)
  const season = semester % 2 === 0 ? '春季' : '秋季'
  return `${year} 年${season}（第 ${semester} 学期）`
}
