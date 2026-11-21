import { mkdirSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  BIOMEDICAL_MAJOR, ELECTIVE_MODULE, ENGINEERING_MAJOR, SCIENCE_MAJOR,
} from '../src/lib/electives.ts'
import type { Course, ElectivePlan } from '../src/types.ts'
import { readCohort } from './seed/2024.ts'

type Offering = { credits: number; semester: string }
type FoundationOffering = Offering & { module: string; majors: string[] }
type ElectiveOffering = Offering & { group: number; category: string }
type ProfessionalDetails = {
  foundation?: FoundationOffering
  core?: Record<string, Offering>
  electives?: ElectiveOffering[]
}

const coreModule = '专业核心课'
const byCourses = (groups: number[], minimum: number) => ({ groups, minimum, unit: '门' as const })
const byCredits = (groups: number[], minimum: number) => ({ groups, minimum, unit: '学分' as const })
const plans: Record<string, ElectivePlan> = {
  统计学: { limitedCredits: 12, freeCredits: 4, limited: [byCourses([24], 2), byCourses([30], 2)] },
  应用统计学: { limitedCredits: 12, freeCredits: 4, limited: [byCourses([26], 4), byCourses([28], 1), byCourses([30], 1)] },
  经济统计学: { limitedCredits: 12, freeCredits: 4, limited: [byCredits([27], 8), byCredits([31], 3)] },
  [SCIENCE_MAJOR]: { limitedCredits: 12, freeCredits: 4, limited: [byCourses([24, 25, 28], 2), byCourses([12, 14, 15], 2)] },
  [ENGINEERING_MAJOR]: {
    limitedCredits: 19, freeCredits: 5,
    limited: [byCourses([15], 2), byCourses([11], 1), byCourses([12, 13, 14, 16], 1), byCourses([24, 30], 1)],
  },
}
const plans2024: Record<string, ElectivePlan> = {
  ...plans,
  [ENGINEERING_MAJOR]: {
    limitedCredits: 10, freeCredits: 4,
    limited: [byCourses([15], 2), byCourses([12, 13, 14, 16], 1), byCourses([24, 30], 1)],
    practice: { credits: 5, rules: [byCourses([10], 1), byCourses([11], 1)] },
  },
}
const modules2025 = {
  1: '数学与应用数学', 4: '数据计算及应用', 5: '物理学', 6: '材料物理', 7: '化学', 9: '环境科学与工程',
  10: '计算机类专业实践', 11: '复杂工程实践', 12: '计算机理论基础', 13: '系统与网络',
  14: '人工智能', 15: '大数据技术', 16: '多媒体技术', 17: '软件工程与系统开发',
  18: '信息安全技术', 19: '信息安全应用', 20: '信息管理理论基础', 21: '信息系统技术基础',
  22: '电子商务创新应用', 23: '金融科技创新应用', 24: '概率统计进阶',
  25: '数据科学进阶', 26: '风险精算进阶', 27: '经济统计进阶', 28: '一般统计、算法模型方法',
  29: '实践应用类', 30: '统计学类基础课', 31: '经济社会学类基础课',
  32: '人工智能核心领域', 33: '人工智能理论进阶', 34: '人工智能类', 35: '人工智能交叉',
  36: '科研训练成果认定', 101: '计算机类创研课程', 102: '统计学类创研课',
  103: '数学与应用数学创研课', 104: '数学与应用数学本研衔接课', 105: '数据计算及应用创研课',
  106: '数据计算及应用本研衔接课', 107: '化学类创研课', 108: '环境类创研课',
}
const statisticsSupplement2025 = {
  groups: [24, 25, 26, 27, 28, 29, 30, 31, 102],
  label: '统计学类（补齐限选学分）',
}
const plans2025: Record<string, ElectivePlan> = {
  统计学: { limitedCredits: 12, freeCredits: 4, limited: [byCredits([24], 4), byCredits([30], 4)], supplement: statisticsSupplement2025 },
  应用统计学: { limitedCredits: 12, freeCredits: 4, limited: [byCredits([26], 6), byCredits([25, 28, 30, 102], 6)] },
  经济统计学: { limitedCredits: 12, freeCredits: 4, limited: [byCredits([27, 31], 8)], supplement: statisticsSupplement2025 },
  [SCIENCE_MAJOR]: { limitedCredits: 12, freeCredits: 4, limited: [byCredits([24, 25, 28], 8)], supplement: statisticsSupplement2025 },
  [ENGINEERING_MAJOR]: {
    limitedCredits: 10, freeCredits: 3, limited: [byCourses([15], 2), byCourses([12, 13, 14, 16], 1), byCourses([101], 1)],
    practice: { credits: 5, rules: [byCourses([10], 1), byCourses([11], 1)] },
  },
}
const modules2026 = {
  ...modules2025,
  13: '计算机系统', 18: '安全与可信',
  109: '量子信息科学', 110: '物理类本研衔接课', 111: '化学类本研衔接模块',
  112: '环境科学与工程本研衔接模块', 113: '统计学类本研衔接课', 114: '生物统计进阶',
}
const statisticsSupplement2026 = {
  ...statisticsSupplement2025, groups: [...statisticsSupplement2025.groups, 114],
}
const plans2026: Record<string, ElectivePlan> = {
  统计学: { ...plans2025.统计学, supplement: statisticsSupplement2026 },
  应用统计学: plans2025.应用统计学,
  经济统计学: { ...plans2025.经济统计学, supplement: statisticsSupplement2026 },
  [SCIENCE_MAJOR]: { ...plans2025[SCIENCE_MAJOR], supplement: statisticsSupplement2026 },
  [BIOMEDICAL_MAJOR]: {
    limitedCredits: 12, freeCredits: 4,
    limited: [byCredits([114], 4), byCredits([30], 4)], supplement: statisticsSupplement2026,
  },
}
const graduateGroups2026 = new Set([104, 106, 110, 111, 112, 113])

const engineeringCourses: Course[] = [
  {
    id: 'engineering-integrated-design', name: '综合设计', aliases: [], codes: [],
    credits: 2, creditsLabel: '2', semester: '第一学年暑期', modules: ['专业实习'],
    groups: ['三、创新训练与科学研究'], majors: [ENGINEERING_MAJOR],
  },
  {
    id: 'engineering-academic-writing', name: '学术调研与论文写作', aliases: [], codes: [],
    credits: 2, creditsLabel: '2', semester: '6', modules: ['毕业论文（设计）'],
    groups: ['三、创新训练与科学研究'], majors: [ENGINEERING_MAJOR],
  },
]

function seedCatalog(db: DatabaseSync, root: string) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const initialized = db.prepare('SELECT 1 FROM catalog_imports WHERE cohort = ?').get(2023)
    if (!initialized) {
      const sources = JSON.parse(readFileSync(join(root, 'server/seed/courses.json'), 'utf8')) as Course[]
      const professional = JSON.parse(readFileSync(join(root, 'server/seed/professional-2023.json'), 'utf8')) as Record<string, ProfessionalDetails>
      const storeCourse = db.prepare('INSERT INTO catalog_courses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      const storeProfile = db.prepare('INSERT INTO catalog_majors VALUES (?, ?, ?, ?, ?)')
      const storeRole = db.prepare('INSERT INTO catalog_major_roles VALUES (?, ?, ?, ?, ?, ?)')
      const storeElective = db.prepare('INSERT INTO catalog_elective_offerings VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const [name, plan] of Object.entries(plans)) {
        storeProfile.run(2023, name, plan.limitedCredits, plan.freeCredits, JSON.stringify(plan.limited))
      }
      for (const [position, course] of [...sources.filter((item) => item.id !== 'C0188'), ...engineeringCourses].entries()) {
        storeCourse.run(2023, course.id, position, course.name, course.credits, course.creditsLabel, course.semester,
          JSON.stringify(course.codes), JSON.stringify(course.aliases),
          JSON.stringify({ modules: course.modules, groups: course.groups, majors: course.majors }))
        const detail = professional[course.id]
        if (detail?.foundation) {
          const { majors, module, credits, semester } = detail.foundation
          for (const major of majors.length ? majors : ['']) storeRole.run(2023, course.id, major, module, credits, semester)
        }
        for (const [major, role] of Object.entries(detail?.core ?? {})) {
          storeRole.run(2023, course.id, major, coreModule, role.credits, role.semester)
        }
        for (const [index, option] of (detail?.electives ?? []).entries()) {
          storeElective.run(2023, course.id, index, option.group, option.category, option.credits, option.semester)
        }
      }
      db.prepare('INSERT INTO catalog_imports VALUES (?, ?)').run(2023, new Date().toISOString())
    }
    for (const [cohort, profiles] of [[2024, plans2024], [2025, plans2025], [2026, plans2026]] as const) {
      if (db.prepare('SELECT 1 FROM catalog_imports WHERE cohort = ?').get(cohort)) continue
      const { courses, roles, electives } = readCohort(root, cohort)
      const storeCourse = db.prepare('INSERT INTO catalog_courses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      const storeProfile = db.prepare('INSERT INTO catalog_majors VALUES (?, ?, ?, ?, ?)')
      const storeRole = db.prepare('INSERT INTO catalog_major_roles VALUES (?, ?, ?, ?, ?, ?)')
      const storeElective = db.prepare('INSERT INTO catalog_elective_offerings VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const [name, plan] of Object.entries(profiles)) {
        const names = cohort === 2026 ? modules2026 : cohort === 2025 ? modules2025 : undefined
        const fullPlan = names ? { ...plan, groupNames: names } : plan
        storeProfile.run(cohort, name, plan.limitedCredits, plan.freeCredits, JSON.stringify(fullPlan))
      }
      for (const [position, course] of courses.entries()) {
        const { id, name, credits, creditsLabel, semester, codes, aliases, ...scope } = course
        storeCourse.run(cohort, id, position, name, credits, creditsLabel, semester,
          JSON.stringify(codes), JSON.stringify(aliases), JSON.stringify(scope))
      }
      for (const role of roles) {
        storeRole.run(cohort, role.course.id, role.major, role.module, role.credits, role.semester)
      }
      for (const [position, option] of electives.entries()) {
        storeElective.run(cohort, option.course.id, position, option.group, option.category, option.credits, option.semester)
      }
      db.prepare('INSERT INTO catalog_imports VALUES (?, ?)').run(cohort, new Date().toISOString())
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function withRole(course: Course, offering: Offering, module: string): Course {
  return { ...course, credits: offering.credits, creditsLabel: String(offering.credits), semester: offering.semester, modules: [module] }
}

type RoleRow = Offering & { major: string; module: string }

function forMajor(course: Course, major: string, cohort: number, plan: ElectivePlan, roles: RoleRow[], electives: ElectiveOffering[]) {
  if (!roles.length && !electives.length) {
    if (cohort === 2026 && major === '经济统计学' && course.creditPool === 'civic-optional' && course.name === '习近平经济思想概论') return
    if (major === ENGINEERING_MAJOR && (course.id === 'C0394' || cohort === 2024 && course.name === '专业实习')) {
      return { ...course, credits: 2, creditsLabel: '2' }
    }
    if (cohort === 2025 && major === ENGINEERING_MAJOR && course.name === '毕业论文（设计）') {
      return { ...course, credits: 2, creditsLabel: '2' }
    }
    return course.majors.includes('全部') || course.majors.includes(major) ? course : undefined
  }
  const required = roles.find((role) => role.major === major && role.module === coreModule)
    ?? roles.find((role) => role.major === major)
  if (required) return withRole(course, required, required.module)
  if (cohort === 2026 && course.name === '习近平经济思想概论') return
  if (cohort < 2025 && (major === SCIENCE_MAJOR || major === ENGINEERING_MAJOR) && course.name.startsWith('数据科学实践')) return
  if (cohort >= 2024 && !roles.length && electives.every((offering) => offering.group === 36)) return
  if (cohort === 2026) {
    const undergraduate = electives.filter((offering) => !graduateGroups2026.has(offering.group))
    if (!undergraduate.length && !roles.length) return withRole(course, electives[0], '本研贯通课（不计入本科学分）')
    electives = undergraduate
  }

  const rules = [...plan.limited, ...(plan.practice?.rules ?? [])]
  const excludedFromLimits = cohort === 2025 && major === ENGINEERING_MAJOR && course.name === '信息管理前沿探索'
  const groupMatches = excludedFromLimits ? [] : electives.filter((offering) =>
    rules.some((rule) => rule.groups.includes(offering.group)) || plan.supplement?.groups.includes(offering.group))
  const engineeringOptions = cohort === 2023 && major === ENGINEERING_MAJOR
    ? electives.filter((offering) => ['计算机类', '统计学类'].includes(offering.category))
    : []
  const scienceCore = cohort === 2023 && major === ENGINEERING_MAJOR
    ? roles.find((role) => role.major === SCIENCE_MAJOR && role.module === coreModule)
    : undefined
  const preferred = groupMatches.length ? groupMatches : engineeringOptions.length ? engineeringOptions : electives
  const offering = groupMatches[0] ?? engineeringOptions[0] ?? scienceCore ?? preferred[0] ?? roles[0]
  if (!offering) return
  const semesters = [...new Set(preferred.filter((item) => item.credits === offering.credits)
    .flatMap((item) => item.semester.split(/[,，]/).map((term) => term.trim())))].sort().join(', ')
  const useScienceCore = !groupMatches.length && !engineeringOptions.length && Boolean(scienceCore)
  const semester = useScienceCore ? offering.semester : semesters || offering.semester
  return {
    ...withRole(course, { ...offering, semester }, ELECTIVE_MODULE),
    electiveKind: groupMatches.length || engineeringOptions.length || scienceCore ? 'limited' : 'free',
    electiveGroups: [...new Set(groupMatches.map((item) => item.group))],
    ...(cohort >= 2024 ? { electiveOfferings: groupMatches.map(({ group, credits, semester }) => ({ group, credits, semester })) } : {}),
  } satisfies Course
}

export function openCatalog(root: string) {
  const filename = process.env.CATALOG_DB || resolve(root, 'data/catalog.sqlite')
  mkdirSync(dirname(filename), { recursive: true })
  const db = new DatabaseSync(filename)
  try {
    db.exec(`
      PRAGMA busy_timeout = 5000;
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS catalog_imports (cohort INTEGER PRIMARY KEY, imported_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS catalog_courses (
        cohort INTEGER NOT NULL, id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL,
        credits REAL NOT NULL, credits_label TEXT NOT NULL, semester TEXT NOT NULL,
        codes_json TEXT NOT NULL, aliases_json TEXT NOT NULL, scope_json TEXT NOT NULL,
        PRIMARY KEY (cohort, id)
      );
      CREATE TABLE IF NOT EXISTS catalog_majors (
        cohort INTEGER NOT NULL, name TEXT NOT NULL, limited_credits INTEGER NOT NULL,
        free_credits INTEGER NOT NULL, rules_json TEXT NOT NULL, PRIMARY KEY (cohort, name)
      );
      CREATE TABLE IF NOT EXISTS catalog_major_roles (
        cohort INTEGER NOT NULL, course_id TEXT NOT NULL, major TEXT NOT NULL, module TEXT NOT NULL,
        credits REAL NOT NULL, semester TEXT NOT NULL,
        PRIMARY KEY (cohort, course_id, major, module),
        FOREIGN KEY (cohort, course_id) REFERENCES catalog_courses(cohort, id)
      );
      CREATE TABLE IF NOT EXISTS catalog_elective_offerings (
        cohort INTEGER NOT NULL, course_id TEXT NOT NULL, position INTEGER NOT NULL,
        elective_group INTEGER NOT NULL, category TEXT NOT NULL, credits REAL NOT NULL, semester TEXT NOT NULL,
        PRIMARY KEY (cohort, course_id, position),
        FOREIGN KEY (cohort, course_id) REFERENCES catalog_courses(cohort, id)
      );
    `)
    seedCatalog(db, root)
  } catch (error) {
    db.close()
    throw error
  }

  const allCourses = db.prepare('SELECT * FROM catalog_courses WHERE cohort = ? ORDER BY position')
  const courseRoles = db.prepare('SELECT course_id, major, module, credits, semester FROM catalog_major_roles WHERE cohort = ? ORDER BY rowid')
  const courseElectives = db.prepare(`
    SELECT course_id, elective_group AS "group", category, credits, semester
    FROM catalog_elective_offerings WHERE cohort = ? ORDER BY course_id, position
  `)
  const majorPlan = db.prepare('SELECT * FROM catalog_majors WHERE cohort = ? AND name = ?')

  function byCourse<T extends { course_id: string }>(rows: T[]) {
    const index = new Map<string, T[]>()
    for (const row of rows) {
      const existing = index.get(row.course_id)
      if (existing) existing.push(row)
      else index.set(row.course_id, [row])
    }
    return index
  }

  function get(major: string, cohort: number) {
    const planRow = majorPlan.get(cohort, major)
    if (!planRow) return
    const rules = JSON.parse(String(planRow.rules_json))
    const electivePlan: ElectivePlan = Array.isArray(rules) ? {
      limitedCredits: Number(planRow.limited_credits),
      freeCredits: Number(planRow.free_credits),
      limited: rules,
    } : rules
    const roles = byCourse(courseRoles.all(cohort) as (RoleRow & { course_id: string })[])
    const electives = byCourse(courseElectives.all(cohort) as (ElectiveOffering & { course_id: string })[])
    const catalog = allCourses.all(cohort).map((row): Course => ({
      ...JSON.parse(String(row.scope_json)),
      id: String(row.id), name: String(row.name), credits: Number(row.credits),
      creditsLabel: String(row.credits_label), semester: String(row.semester),
      codes: JSON.parse(String(row.codes_json)), aliases: JSON.parse(String(row.aliases_json)),
    }))
    const courses = catalog.flatMap((course) => {
      const assigned = forMajor(course, major, cohort, electivePlan, roles.get(course.id) ?? [], electives.get(course.id) ?? [])
      return assigned ? [assigned] : []
    })
    return {
      courses, electivePlan,
      recordsCatalog: catalog.map(({ id, name, codes, creditsLabel }) => ({ id, name, codes, creditsLabel })),
    }
  }

  function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = URL.parse(req.url ?? '/', 'http://localhost')
    if (!url?.pathname.startsWith('/api/')) return next()
    const send = (status: number, data: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(data))
    }
    if (url.pathname !== '/api/catalog') return send(404, { error: '接口不存在。' })
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return send(405, { error: '此接口只支持读取。' })
    }
    try {
      const cohort = Number(url.searchParams.get('cohort') ?? 2023)
      const selectedMajor = url.searchParams.get('major') ?? '统计学'
      const major = cohort >= 2025 && selectedMajor === '数据科学' ? SCIENCE_MAJOR : selectedMajor
      const data = get(major, cohort)
      if (!data) return send(400, { error: '未找到该专业的培养方案。' })
      return send(200, data)
    } catch (error) {
      console.error(error)
      return send(500, { error: '课程目录暂时无法读取。' })
    }
  }

  return { middleware, close: () => db.close() }
}
