import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BIOMEDICAL_MAJOR, ELECTIVE_MODULE, ENGINEERING_MAJOR, SCIENCE_MAJOR } from '../../src/lib/electives.ts'
import type { Course, EnglishLevel } from '../../src/types.ts'

const GENERAL = '一、通识模块'
const PROFESSIONAL = '二、专业模块'
const RESEARCH = '三、创新训练与科学研究'
const DEVELOPMENT = '四、素质拓展与发展指导'
const profileNames = { S: '统计学', A: '应用统计学', T: '经济统计学', E: SCIENCE_MAJOR, G: ENGINEERING_MAJOR, M: BIOMEDICAL_MAJOR }
const researchModules = ['研究训练', '专业实习', '毕业论文（设计）', '专业特色创新训练']
const developmentModules = ['公共选修课', '劳动教育', '军事课', '职业生涯规划', '志愿服务']
const equivalentNames: Record<string, string> = {
  '操作系统': '计算机系统基础 II',
  '离散数学': '离散数学 A',
}

export function readCohort(root: string, cohort: number) {
  const courses = new Map<string, Course>()
  const roles: { course: Course; major: string; module: string; credits: number; semester: string }[] = []
  const electives: { course: Course; group: number; category: string; credits: number; semester: string }[] = []
  const file = readFileSync(join(root, `server/seed/courses-${cohort}.tsv`), 'utf8')
  for (const line of file.split(/\r?\n/)) {
    if (!line) continue
    const [type, moduleOrNumber, rawName, rawCodes, credit, semester, flags = ''] = line.split('\t')
    const name = rawName.replace(/（含[^）]*学时实践）/g, '')
    const baseName = cohort >= 2025 ? name.replace(/（TS）|\s+T[CS]$/g, '') : name
    const identity = equivalentNames[name] ?? name
    const codes = rawCodes.split('/').filter(Boolean)
    const key = cohort >= 2025 ? `${type === 'elective' || type === 'core' || type === 'foundation' ? 'professional' : type}:${baseName.normalize('NFKC').replace(/\s+/g, '')}` : `${codes[0] ?? ''}:${identity}`
    const credits = Number(credit)
    const module = type === 'elective' ? ELECTIVE_MODULE : moduleOrNumber
    const professional = type === 'core' || type === 'foundation' || type === 'elective' || type === 'graduate'
    const group = professional ? PROFESSIONAL
      : cohort >= 2025 ? (researchModules.includes(module) || module === '公共选修课' ? RESEARCH : GENERAL)
      : researchModules.includes(module) ? RESEARCH : developmentModules.includes(module) ? DEVELOPMENT : GENERAL
    let course = courses.get(key)
    if (!course) {
      course = {
        id: `${cohort % 100}-${courses.size + 1}`, name: baseName, codes, aliases: [],
        credits, creditsLabel: String(credits), semester, modules: [module], groups: [group],
        majors: type === 'engineering' ? [ENGINEERING_MAJOR] : type === 'inactive' ? [] : ['全部'],
      }
      if (module === '公共艺术教育' || module === '美育课程') course.creditPool = 'art'
      if (module === '公共体育' && flags === 'core') course.creditPool = 'sports-core'
      if (module === '公共体育' && flags === 'specialty') course.creditPool = 'sports-specialty'
      if ((module === '思想政治理论课' || module === '思政课') && flags === 'optional') course.creditPool = 'civic-optional'
      if (module === '基础技能 - 公共外语' || module === '公共外语拓展课') {
        course.englishTerms = {}
        if (cohort >= 2025) {
          for (const assignment of flags.split(';').filter(Boolean)) {
            const [level, term] = assignment.split('=')
            course.englishTerms[level as EnglishLevel] = term
          }
        } else {
          for (const level of ['A', 'B', 'X'] as const) {
            if (flags.includes(level)) course.englishTerms[level] = level === 'X' && codes.includes('BELLCE0010') ? '1' : semester
          }
        }
      }
      courses.set(key, course)
      // The foundation table lists both codes for the same data structures course.
      for (const code of codes.slice(1)) courses.set(`${code}:${identity}`, course)
    }
    for (const alias of [name, rawName]) {
      if (alias !== course.name && !course.aliases.includes(alias)) course.aliases.push(alias)
    }
    if (type === 'core' || type === 'foundation') {
      const majors = flags === 'all' ? Object.values(profileNames).filter((major) => cohort === 2026 ? major !== ENGINEERING_MAJOR : major !== BIOMEDICAL_MAJOR)
        : [...flags].map((flag) => profileNames[flag as keyof typeof profileNames])
      for (const major of majors.length ? majors : ['']) roles.push({ course, major, module, credits, semester })
    }
    if (type === 'elective') electives.push({ course, group: Number(moduleOrNumber), category: flags, credits, semester })
  }
  return { courses: [...new Set(courses.values())], roles, electives }
}
