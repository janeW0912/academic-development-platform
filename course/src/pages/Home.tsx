import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Download, Search, ShieldCheck, Trash2 } from 'lucide-react'
import type { CompletedRecord, Course, CourseCatalog, ElectiveRule, EnglishLevel, TranscriptRow } from '../types'
import { createDemoRows, matchTranscriptRows, normalizeCourseName, parseTranscriptFile } from '../lib/transcript'
import { displayModuleName, ENGLISH_CREDITS_2025, ENGLISH_ELECTIVES, ENGLISH_FOUNDATION, ENGLISH_LEVELS, ENGLISH_LEVELS_2025, ENGLISH_LEVELS_2026, matchesSemester, PUBLIC_ENGLISH, selectEnglishCourse, semesterLabel } from '../lib/curriculum'
import { BIOMEDICAL_MAJOR, electiveNature, ELECTIVE_MODULE, electiveRuleLabel, ENGINEERING_MAJOR, FOUNDATION_BASIC, FOUNDATION_COMMON, matchesElectiveRule, SCIENCE_MAJOR } from '../lib/electives'
import TranscriptUpload from '../components/TranscriptUpload'
import ReviewDialog from '../components/ReviewDialog'
import CourseTable from '../components/CourseTable'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import '../App.css'

const MAJORS = ['统计学', '应用统计学', '经济统计学', SCIENCE_MAJOR, ENGINEERING_MAJOR]
const MAJORS_2026 = ['统计学', SCIENCE_MAJOR, '应用统计学', '经济统计学', BIOMEDICAL_MAJOR]
const CORE_CREDITS_2026: Record<string, number> = {
  统计学: 44, 应用统计学: 44, 经济统计学: 46, [SCIENCE_MAJOR]: 45, [BIOMEDICAL_MAJOR]: 43,
}
const EMPTY_COURSES: Course[] = []
type ElectiveChoice = {
  id: string
  label: string
  rule?: ElectiveRule
  groups?: number[]
  matches: (course: Course) => boolean
}
const GROUPS = [
  { id: '全部模块', label: '全部课程' },
  { id: '一、通识模块', label: '通识模块' },
  { id: '二、专业模块', label: '专业模块' },
  { id: '三、创新训练与科学研究', label: '创新训练与科研' },
  { id: '四、素质拓展与发展指导', label: '素质拓展与指导' },
]
const GROUP_CREDIT_TARGETS: Record<string, number> = {
  '一、通识模块': 44,
  '三、创新训练与科学研究': 10,
  '四、素质拓展与发展指导': 10,
}
const MODULE_CREDIT_TARGETS: Record<string, Record<string, number>> = {
  '一、通识模块': {
    思想政治理论课: 21,
    公共体育: 4,
    新生研讨课: 2,
    心理健康教育: 1,
    公共艺术教育: 2,
  },
  '二、专业模块': {
    [FOUNDATION_COMMON]: 22,
    [FOUNDATION_BASIC]: 4,
    '本研贯通课（不计入本科学分）': 0,
  },
  '三、创新训练与科学研究': {
    研究训练: 2,
    专业实习: 4,
    '毕业论文（设计）': 4,
  },
  '四、素质拓展与发展指导': {
    劳动教育: 1,
    军事课: 4,
    职业生涯规划: 1,
    志愿服务: 2,
  },
}
const STORAGE_KEY = 'statistics-school-completed-v1'
const STORAGE_KEY_2024 = 'statistics-school-completed-2024-v1'
const STORAGE_KEY_2025 = 'statistics-school-completed-2025-v1'
const STORAGE_KEY_2026 = 'statistics-school-completed-2026-v1'
const MAJOR_KEY = 'statistics-school-major-v1'
const PREFERENCES_KEY = 'statistics-school-course-filters-v1'
const COHORTS = [2026, 2025, 2024, 2023]
const SEMESTERS = Array.from({ length: 8 }, (_, i) => i + 1)

function levelsForCohort(cohort: number) {
  if (cohort === 2026) return ENGLISH_LEVELS_2026
  return cohort === 2025 ? ENGLISH_LEVELS_2025 : ENGLISH_LEVELS
}

function majorsForCohort(cohort: number) {
  return cohort === 2026 ? MAJORS_2026 : MAJORS
}

function englishForCohort(level: unknown, cohort: number): EnglishLevel {
  const levels = levelsForCohort(cohort)
  if (typeof level === 'string' && Object.hasOwn(levels, level)) return level as EnglishLevel
  return cohort >= 2025 ? 'III' : 'A'
}

function readPreferences(): { english: EnglishLevel; cohort: number; semester: number } {
  const defaults = { english: 'A', cohort: 2023, semester: 0 } as const
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}')
    const cohort = COHORTS.includes(saved.cohort) ? saved.cohort : defaults.cohort
    return {
      english: englishForCohort(saved.english, cohort),
      cohort,
      semester: SEMESTERS.includes(saved.semester) ? saved.semester : defaults.semester,
    }
  } catch {
    return defaults
  }
}

function getGroupTarget(groupId: string, major: string, englishCredits: number, cohort: number) {
  if (cohort === 2026) {
    if (groupId === '一、通识模块') return 36 + englishCredits
    if (groupId === '二、专业模块') return 42 + CORE_CREDITS_2026[major]
    return 12
  }
  if (cohort === 2025) {
    if (groupId === '一、通识模块') return (major === ENGINEERING_MAJOR ? 47 : 45) + englishCredits - 2
    if (groupId === '二、专业模块') return major === ENGINEERING_MAJOR ? 91 : major === SCIENCE_MAJOR ? 88 : 86
    return major === ENGINEERING_MAJOR ? 16 : 12
  }
  if (groupId === '二、专业模块') return major === ENGINEERING_MAJOR ? (cohort === 2024 ? 90 : 92) : major === SCIENCE_MAJOR ? 88 : 86
  if (groupId === '一、通识模块') return GROUP_CREDIT_TARGETS[groupId] + englishCredits - 6 + (cohort === 2024 ? 1 : 0)
  return GROUP_CREDIT_TARGETS[groupId] ?? 0
}

function getModuleTarget(groupId: string, moduleName: string, major: string, englishCredits: number, electiveCredits: number, cohort: number) {
  if (moduleName === PUBLIC_ENGLISH) return englishCredits
  if (moduleName === ELECTIVE_MODULE) return electiveCredits
  if (groupId === '二、专业模块' && moduleName === '专业核心课') {
    if (cohort === 2026) return CORE_CREDITS_2026[major]
    return major === ENGINEERING_MAJOR ? ({ 2023: 42, 2024: 45, 2025: 47 }[cohort] ?? 42) : major === SCIENCE_MAJOR ? 46 : 44
  }
  if (cohort >= 2025) {
    const targets: Record<string, number> = {
      新生引导课: 2, 科学与人文素养课: major === ENGINEERING_MAJOR ? 6 : 4, 美育课程: 2,
      心理健康教育: 2, 劳动教育: 1, 职业生涯教育: 1, 军事课: 4, 志愿服务: 2,
      专业特色创新训练: 2, 专业实习: major === ENGINEERING_MAJOR ? 4 : 2, 国际性学习课程: 2, 公共选修课: 2,
      思政课: 14, 创新引导课: 2,
    }
    return targets[moduleName] ?? MODULE_CREDIT_TARGETS[groupId]?.[moduleName] ?? 0
  }
  if (cohort === 2024 && moduleName === '心理健康教育') return 2
  if (cohort === 2024 && moduleName === '公共选修课') return 2
  return MODULE_CREDIT_TARGETS[groupId]?.[moduleName] ?? 0
}

function formatCredits(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function getCountedCredits(completedCourses: Course[], englishCredits: number, englishLevel: EnglishLevel, cohort: number) {
  const earned = { foundation: 0, electives: 0, basic: 0, thesis: 0, other: 0 }
  const pools = { 'civic-optional': 0, 'sports-core': 0, 'sports-specialty': 0, art: 0 }
  for (const course of completedCourses) {
    if (course.modules.includes('本研贯通课（不计入本科学分）')) continue
    if (course.creditPool) pools[course.creditPool] += course.credits
    else if (course.modules.includes(ENGLISH_FOUNDATION)) earned.foundation += course.credits
    else if (course.modules.includes(ENGLISH_ELECTIVES)) earned.electives += course.credits
    else if (course.modules.includes(FOUNDATION_BASIC)) earned.basic += course.credits
    else if (course.modules.includes('毕业论文（设计）')) earned.thesis += course.credits
    else earned.other += course.credits
  }
  const englishSlot = englishLevel === 'II' ? 0 : 2
  if (cohort === 2026) pools['sports-specialty'] += Math.max(0, pools['sports-core'] - 2)
  return earned.other + Math.min(earned.foundation, englishCredits - englishSlot) + Math.min(earned.electives, englishSlot)
    + Math.min(earned.basic, 4) + Math.min(earned.thesis, 4)
    + Object.values(pools).reduce((total, credits) => total + Math.min(credits, 2), 0)
}

function getRemainingText(completed: number, target: number) {
  if (target === 0) return '不计入本科学分'
  if (completed >= target) return '已达标'
  return `还差 ${formatCredits(target - completed)} 学分`
}

function readCompleted(key: string): Record<string, CompletedRecord> {
  try {
    const records = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, CompletedRecord>
    if (records.C0188) {
      records.C0133 ??= { ...records.C0188, courseId: 'C0133' }
      delete records.C0188
    }
    return records
  } catch {
    return {}
  }
}

export default function Home() {
  const [preferences, setPreferences] = useState(readPreferences)
  const { english, cohort, semester } = preferences
  const [major, setMajor] = useState(() => {
    const saved = localStorage.getItem(MAJOR_KEY)
    return saved && majorsForCohort(cohort).includes(saved) ? saved : '统计学'
  })
  const englishLevels = levelsForCohort(cohort)
  const englishCredits = ENGLISH_CREDITS_2025[english] ?? (english === 'X' ? 10 : 6)
  const majorLabel = (value: string) => value === SCIENCE_MAJOR ? (cohort >= 2025 ? '数据科学' : `${value}（理学）`) : value
  const moduleLabel = (value: string) => {
    if (cohort >= 2025 && value === ELECTIVE_MODULE) return '专业选修课'
    if (cohort === 2026 && value === '本研贯通课（不计入本科学分）') return '本研衔接课（不计入本科学分）'
    return value
  }
  const [query, setQuery] = useState('')
  const [openGroup, setOpenGroup] = useState('一、通识模块')
  const [selectedModule, setSelectedModule] = useState<{ groupId: string; name: string } | null>(null)
  const [electiveFilter, setElectiveFilter] = useState('limited')
  const [completed2023, setCompleted2023] = useState(() => readCompleted(STORAGE_KEY))
  const [completed2024, setCompleted2024] = useState(() => readCompleted(STORAGE_KEY_2024))
  const [completed2025, setCompleted2025] = useState(() => readCompleted(STORAGE_KEY_2025))
  const [completed2026, setCompleted2026] = useState(() => readCompleted(STORAGE_KEY_2026))
  const completionsByYear = {
    2023: [completed2023, setCompleted2023], 2024: [completed2024, setCompleted2024],
    2025: [completed2025, setCompleted2025], 2026: [completed2026, setCompleted2026],
  } as const
  const [completed, setCompleted] = completionsByYear[cohort as keyof typeof completionsByYear]
  const [reviewRows, setReviewRows] = useState<TranscriptRow[]>([])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [clearOpen, setClearOpen] = useState(false)
  const [catalogResult, setCatalogResult] = useState<{ major: string; cohort: number; data?: CourseCatalog; error?: string } | null>(null)
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed2023))
    localStorage.setItem(STORAGE_KEY_2024, JSON.stringify(completed2024))
    localStorage.setItem(STORAGE_KEY_2025, JSON.stringify(completed2025))
    localStorage.setItem(STORAGE_KEY_2026, JSON.stringify(completed2026))
  }, [completed2023, completed2024, completed2025, completed2026])

  useEffect(() => {
    localStorage.setItem(MAJOR_KEY, major)
  }, [major])

  useEffect(() => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  }, [preferences])

  useEffect(() => {
    const controller = new AbortController()
    async function loadCatalog() {
      try {
        const response = await fetch('/api/catalog?' + new URLSearchParams({ major, cohort: String(cohort) }), { signal: controller.signal })
        if (!response.ok) throw new Error('课程目录暂时无法读取。')
        const data: CourseCatalog = await response.json()
        if (!controller.signal.aborted) setCatalogResult({ major, cohort, data })
      } catch {
        if (!controller.signal.aborted) setCatalogResult({ major, cohort, error: '课程库暂时无法读取，请重试。' })
      }
    }
    void loadCatalog()
    return () => controller.abort()
  }, [major, cohort, catalogAttempt])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const notify = (message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3200)
  }

  const currentCatalog = catalogResult?.major === major && catalogResult.cohort === cohort ? catalogResult : null
  const catalog = currentCatalog?.data
  const coursesForMajor = catalog?.courses ?? EMPTY_COURSES
  const majorCourses = useMemo(
    () => coursesForMajor.flatMap((course) => selectEnglishCourse(course, english)),
    [coursesForMajor, english],
  )
  const electivePlan = catalog?.electivePlan
  const electiveCredits = electivePlan ? electivePlan.limitedCredits + electivePlan.freeCredits + (electivePlan.practice?.credits ?? 0) : 0
  const isElectiveModule = Boolean(electivePlan && selectedModule?.name === ELECTIVE_MODULE)
  const electiveChoices = useMemo<ElectiveChoice[]>(() => {
    if (!electivePlan) return []
    const { practice, supplement, groupNames } = electivePlan
    const limitedGroups = [...electivePlan.limited.flatMap((rule) => rule.groups), ...(supplement?.groups ?? [])]
    const ruleChoices = (rules: typeof electivePlan.limited, prefix: string) => rules.map((rule, index) => ({
      id: `${prefix}-${index}`,
      label: electiveRuleLabel(rule, groupNames),
      rule,
      groups: rule.groups,
      matches: (course: Course) => matchesElectiveRule(course, rule),
    }))
    return [
      ...(practice ? [
        { id: 'practice', label: `实践课程（${practice.credits} 学分）`, groups: practice.rules.flatMap((rule) => rule.groups),
          matches: (course: Course) => practice.rules.some((rule) => matchesElectiveRule(course, rule)) },
        ...ruleChoices(practice.rules, 'practice'),
      ] : []),
      { id: 'limited', label: `模块限选课（${electivePlan.limitedCredits} 学分）`, groups: limitedGroups,
        matches: (course: Course) => practice
          ? electivePlan.limited.some((rule) => matchesElectiveRule(course, rule)) : course.electiveKind === 'limited' },
      ...ruleChoices(electivePlan.limited, 'limited'),
      ...(supplement ? [{
        id: 'supplement', label: supplement.label, groups: supplement.groups,
        matches: (course: Course) => supplement.groups.some((group) => course.electiveGroups?.includes(group)),
      }] : []),
      { id: 'free', label: `${cohort === 2026 ? '专业任选课' : '个性化任选课'}（${electivePlan.freeCredits} 学分）`, matches: () => true },
    ]
  }, [electivePlan, cohort])
  const activeElectiveChoice = isElectiveModule ? (electiveChoices.find((choice) => choice.id === electiveFilter) ?? electiveChoices[0]) : undefined
  const eligibleElectives = useMemo(() => majorCourses.filter((course) => course.modules.includes(ELECTIVE_MODULE)), [majorCourses])
  const visibleCourses = useMemo(
    () => majorCourses.filter((course) => matchesSemester(course, semester)),
    [majorCourses, semester],
  )

  const majorCompletedCredits = useMemo(
    () => getCountedCredits(majorCourses.filter((course) => completed[course.id]), englishCredits, english, cohort),
    [majorCourses, completed, englishCredits, english, cohort],
  )

  const searchResults = useMemo(() => {
    const normalizedQuery = normalizeCourseName(query)
    if (!normalizedQuery) return []
    return visibleCourses.filter((course) => {
      const haystack = normalizeCourseName([
        course.name,
        ...course.aliases,
        ...course.codes,
        ...course.modules,
        course.electiveKind ? electiveNature(course) : '',
      ].join(' '))
      return haystack.includes(normalizedQuery)
    })
  }, [visibleCourses, query])

  const moduleCourses = useMemo(() => {
    if (!selectedModule) return []
    if (activeElectiveChoice) {
      const { groups } = activeElectiveChoice
      return eligibleElectives.filter(activeElectiveChoice.matches).flatMap((course) => {
        if (!groups || !course.electiveOfferings) return matchesSemester(course, semester) ? [course] : []
        const offerings = course.electiveOfferings.filter((option) => groups.includes(option.group))
        const first = offerings.find((option) => matchesSemester({ ...course, semester: option.semester }, semester))
        if (!first) return []
        const terms = [...new Set(offerings.filter((option) => option.credits === first.credits)
          .flatMap((option) => option.semester.split(', ')))].sort().join(', ')
        return [{ ...course, credits: first.credits, creditsLabel: String(first.credits), semester: terms }]
      })
    }
    return visibleCourses.filter((course) => course.groups.includes(selectedModule.groupId)
      && course.modules.some((name) => displayModuleName(name) === selectedModule.name))
  }, [visibleCourses, selectedModule, activeElectiveChoice, eligibleElectives, semester])

  const groupStats = useMemo(() => GROUPS.slice(1).filter((item) => cohort < 2025 || item.id !== '四、素质拓展与发展指导').map((item) => {
    const groupCourses = majorCourses.filter((course) => course.groups.includes(item.id))
    const completedCourses = groupCourses.filter((course) => completed[course.id])
    const moduleNames = new Set(groupCourses.flatMap((course) => course.modules.map(displayModuleName)))
    if (cohort >= 2025 && item.id === '一、通识模块') moduleNames.add('科学与人文素养课')
    if (cohort >= 2025 && item.id === '三、创新训练与科学研究') {
      moduleNames.add('国际性学习课程')
      if (cohort === 2026) moduleNames.add('创新引导课')
    }
    const moduleStats = Array.from(moduleNames, (module) => {
      const moduleCompleted = module === ELECTIVE_MODULE
        ? eligibleElectives.filter((course) => completed[course.id])
        : completedCourses.filter((course) => course.modules.some((name) => displayModuleName(name) === module))
      return {
        name: module,
        credits: getCountedCredits(moduleCompleted, englishCredits, english, cohort),
        target: getModuleTarget(item.id, module, major, englishCredits, electiveCredits, cohort),
        count: moduleCompleted.length,
      }
    })
    return {
      ...item,
      label: cohort >= 2025 && item.id === '一、通识模块' ? '立本模块'
        : cohort >= 2025 && item.id === '三、创新训练与科学研究' ? '卓越模块' : item.label,
      credits: getCountedCredits(completedCourses, englishCredits, english, cohort),
      target: getGroupTarget(item.id, major, englishCredits, cohort),
      count: completedCourses.length,
      modules: moduleStats,
    }
  }), [majorCourses, completed, major, englishCredits, english, eligibleElectives, electiveCredits, cohort])

  const completedCount = catalog?.recordsCatalog.filter((course) => completed[course.id]).length ?? Object.keys(completed).length
  const targetCredits = groupStats.reduce((total, group) => total + group.target, 0)
  const completion = Math.min(100, Math.round((majorCompletedCredits / targetCredits) * 100))
  const isSearching = Boolean(normalizeCourseName(query))
  const displayedCourses = isSearching ? searchResults.slice(0, 24) : moduleCourses
  const resultCount = isSearching ? searchResults.length : moduleCourses.length
  const resultTitle = isSearching ? `“${query}”的搜索结果` : moduleLabel(selectedModule?.name ?? '课程检索')

  const handleFile = async (file: File) => {
    if (!catalog) return
    setIsParsing(true)
    setError('')
    try {
      const rows = await parseTranscriptFile(file)
      setReviewRows(matchTranscriptRows(rows, majorCourses))
      setFileName(file.name)
      setReviewOpen(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '成绩单读取失败，请检查文件后重试。')
    } finally {
      setIsParsing(false)
    }
  }

  const handleDemo = () => {
    if (!catalog) return
    setError('')
    setReviewRows(matchTranscriptRows(createDemoRows(), majorCourses))
    setFileName('示例成绩单.xlsx')
    setReviewOpen(true)
  }

  const confirmImport = () => {
    const selected = reviewRows.filter((row) => row.selected && row.matchId && row.passStatus !== 'failed')
    if (!selected.length) return
    const now = new Date().toISOString()
    setCompleted((current) => {
      const next = { ...current }
      selected.forEach((row) => {
        next[row.matchId] = {
          courseId: row.matchId,
          score: row.score,
          source: '成绩单导入',
          importedAt: now,
          fileName,
        }
      })
      return next
    })
    setReviewOpen(false)
    notify(`已导入 ${selected.length} 门课程，学业进度已更新`)
  }

  const toggleCourse = (courseId: string) => {
    setCompleted((current) => {
      const next = { ...current }
      if (next[courseId]) delete next[courseId]
      else next[courseId] = { courseId, score: '', source: '手动标记', importedAt: new Date().toISOString() }
      return next
    })
  }

  const exportCompleted = () => {
    const activeCourses = new Map(majorCourses.map((course) => [course.id, course]))
    const rows = catalog?.recordsCatalog.filter((course) => completed[course.id]) ?? []
    if (!rows.length) return
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
    const content = [
      ['课程名称', '课程编码', '学分', '成绩', '来源', '课程模块'],
      ...rows.map((course) => {
        const record = completed[course.id]
        const active = activeCourses.get(course.id)
        const module = active?.electiveKind ? electiveNature(active) : active?.modules.map(displayModuleName).join('/')
        return [course.name, course.codes.join('/'), active?.creditsLabel ?? course.creditsLabel, record.score, record.source, module ?? '当前方案未归类']
      }),
    ].map((row) => row.map(escape).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = '已修课程.csv'
    link.click()
    URL.revokeObjectURL(url)
    notify('已修课程已导出')
  }

  const selectModule = (groupId: string, name: string) => {
    setSelectedModule({ groupId, name })
    setElectiveFilter('limited')
    setQuery('')
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#courses">跳转到课程列表</a>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="统计学院学业规划平台首页">
          <img className="brand-logo" src="./icons/statistics-college.jpg" alt="统计学院院徽" />
          <span>统计学院<strong>学业规划平台</strong></span>
        </a>
        <nav aria-label="页面导航">
          <a href="#upload">成绩单导入</a>
          <a href="#courses">课程与学分</a>
        </nav>
        <span className="local-label"><ShieldCheck aria-hidden="true" size={15} />本地保存</span>
      </header>

      <main id="top">
        <section className="hero-section" aria-labelledby="page-title">
          <div className="hero-copy">
            <h1 id="page-title">本科培养方案 · 选课规划</h1>
            <p>根据修课记录查看学分进度和毕业要求。</p>
            <figure className="calendar-card" aria-label="中国人民大学 2026—2027 学年校历">
              <img src="./calendar.jpg" alt="中国人民大学 2026—2027 学年校历" />
            </figure>
          </div>
          <TranscriptUpload isParsing={isParsing} catalogReady={Boolean(catalog)} error={error} onFile={handleFile} onDemo={handleDemo} />
        </section>

        <section className="metrics-section" aria-label="学业规划摘要">
          <div className="metric"><span>已修课程</span><strong>{completedCount}<small>门</small></strong></div>
          <div className="metric"><span>已获学分</span><strong>{majorCompletedCredits.toFixed(majorCompletedCredits % 1 ? 1 : 0)}<small>学分</small></strong></div>
          <div className="metric progress-metric">
            <span>学分参考进度</span><strong>{completion}<small>%</small></strong>
            <div className="progress-track" aria-label={`学分参考进度 ${completion}%`}><span style={{ width: `${completion}%` }} /></div>
            <small>{majorCompletedCredits} / {targetCredits} 学分</small>
          </div>
        </section>

        <section id="courses" className="curriculum-section" aria-labelledby="curriculum-title">
          <aside className="curriculum-sidebar">
            <div className="sidebar-heading">
              <span className="section-index">培养方案</span>
              <h2 id="curriculum-title">分级模块</h2>
            </div>
            <fieldset className="filter-fieldset">
              <legend>专业方向</legend>
              {majorsForCohort(cohort).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`major-option${major === item ? ' active' : ''}`}
                  aria-pressed={major === item}
                  disabled={isParsing || reviewOpen}
                  onClick={() => { setMajor(item); setSelectedModule(null); setQuery('') }}
                >
                  <span>{majorLabel(item)}</span>{major === item && <CheckCircle2 aria-hidden="true" size={16} />}
                </button>
              ))}
            </fieldset>
            <fieldset className="filter-fieldset study-filters">
              <legend>修读设置</legend>
              <label>
                入学年级
                <select value={cohort} disabled={isParsing || reviewOpen}
                  onChange={(event) => {
                    const year = Number(event.target.value)
                    setPreferences({ ...preferences, cohort: year, english: englishForCohort(english, year) })
                    if (!majorsForCohort(year).includes(major)) setMajor('统计学')
                    setSelectedModule(null)
                  }}>
                  {COHORTS.map((year) => <option key={year} value={year}>{year} 级</option>)}
                </select>
              </label>
              <label>
                开课学期
                <select value={semester} onChange={(event) => setPreferences({ ...preferences, semester: Number(event.target.value) })}>
                  <option value={0}>全部学期</option>
                  {SEMESTERS.map((term) => <option key={term} value={term}>{semesterLabel(cohort, term)}</option>)}
                </select>
              </label>
              <label>
                英语分级
                <select value={english} disabled={isParsing || reviewOpen} onChange={(event) => setPreferences({ ...preferences, english: event.target.value as EnglishLevel })}>
                  {Object.entries(englishLevels).map(([level, label]) => <option key={level} value={level}>{label}</option>)}
                </select>
              </label>
            </fieldset>
            <nav className="module-nav" aria-label="课程分级模块">
              {groupStats.map((groupStat) => (
                <div className="module-group" key={groupStat.id}>
                  <button
                    type="button"
                    className="module-group-toggle"
                    aria-expanded={openGroup === groupStat.id}
                    onClick={() => setOpenGroup(openGroup === groupStat.id ? '' : groupStat.id)}
                  >
                    <span>{openGroup === groupStat.id ? <ChevronDown aria-hidden="true" size={16} /> : <ChevronRight aria-hidden="true" size={16} />}{groupStat.label}</span>
                    <strong className="credit-value">
                      {formatCredits(groupStat.credits)} / {formatCredits(groupStat.target)}<small>学分</small>
                      <small className="credit-remaining">{getRemainingText(groupStat.credits, groupStat.target)}</small>
                    </strong>
                  </button>
                  {openGroup === groupStat.id && (
                    <div className="submodule-list">
                      {groupStat.modules.map((module) => (
                        <button
                          type="button"
                          key={module.name}
                          className={`submodule-option${selectedModule?.groupId === groupStat.id && selectedModule.name === module.name ? ' active' : ''}`}
                          aria-pressed={selectedModule?.groupId === groupStat.id && selectedModule.name === module.name}
                          onClick={() => selectModule(groupStat.id, module.name)}
                        >
                          <span>{moduleLabel(module.name)}<small>{module.count} 门已修</small></span>
                          <strong className="credit-value">
                            {formatCredits(module.credits)} / {module.target > 0 ? formatCredits(module.target) : '—'}<small>学分</small>
                            <small className="credit-remaining">{module.name === ELECTIVE_MODULE && module.credits >= module.target
                              ? '学分已够，请核对限选要求'
                              : getRemainingText(module.credits, module.target)}</small>
                          </strong>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
            <p className="sidebar-note">学分显示为“已修／要求”，并标注剩余待修学分。进度仅作修读参考，毕业审核请以学校教务系统核定为准。</p>
          </aside>

          <div className="curriculum-content">
            <div className="course-toolbar">
              <label className="search-field">
                <Search aria-hidden="true" size={19} />
                <span className="sr-only">搜索并录入课程</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入课程名称或编码，搜索并录入课程" />
              </label>
            </div>
            <div className="list-meta">
              <p>
                <strong>{resultTitle}</strong>
                <span>{isSearching || selectedModule ? `显示 ${displayedCourses.length} / ${resultCount} 门课程` : `${majorLabel(major)} · 请选择模块或搜索`}</span>
              </p>
              <button type="button" className="text-button" disabled={!catalog || !completedCount} onClick={exportCompleted}>
                <Download aria-hidden="true" size={16} />导出已修课程
              </button>
            </div>
            {activeElectiveChoice && electivePlan && !isSearching && (
              <div className="elective-choices" role="group" aria-label={`${moduleLabel(ELECTIVE_MODULE)}要求`}>
                {electiveChoices.map((choice) => {
                  const rule = choice.rule
                  const taken = rule ? eligibleElectives.filter((course) => completed[course.id] && choice.matches(course)) : []
                  const progress = rule?.unit === '学分' ? taken.reduce((sum, course) => sum + course.credits, 0) : taken.length
                  return (
                    <button key={choice.id} type="button" aria-pressed={activeElectiveChoice.id === choice.id}
                      className={rule || choice.id === 'supplement' ? 'elective-rule' : undefined} onClick={() => setElectiveFilter(choice.id)}>
                      <span>{choice.label}</span>
                      {rule && <small>至少 {rule.minimum} {rule.unit} · 该组已修 {formatCredits(progress)} {rule.unit}</small>}
                    </button>
                  )
                })}
                <p className="result-limit">{activeElectiveChoice.id === 'free'
                  ? `这里列出网页已收录的任选候选。培养方案允许在全校各学科大类的部类核心课、专业核心课、${moduleLabel(ELECTIVE_MODULE)}中任选 ${electivePlan.freeCredits} 学分。同一门课只能计入一次。`
                  : cohort === 2023 && major === ENGINEERING_MAJOR
                    ? '各组显示已修的候选课。工学还可选修方案指定的其他专业核心课，本页展示材料中已列明的课程。'
                    : '各组显示已修的候选课。同一门课若出现在多个组，核对修读要求时只能计入一组。'}</p>
              </div>
            )}
            {!catalog ? (
              <div className="module-empty" role="status">
                <p>{currentCatalog?.error ?? '正在读取课程库…'}</p>
                {currentCatalog?.error && <button type="button" className="secondary-button" onClick={() => {
                  setCatalogResult(null)
                  setCatalogAttempt((attempt) => attempt + 1)
                }}>重新加载课程</button>}
              </div>
            ) : cohort >= 2025 && !isSearching && ['科学与人文素养课', '国际性学习课程', '创新引导课'].includes(selectedModule?.name ?? '') ? (
              <div className="module-empty"><p>培养方案列出了课程类别，具体课程以当学期选课系统为准。</p></div>
            ) : isSearching || selectedModule ? (
              <>
                {isSearching && resultCount > 24 && <p className="result-limit">结果较多，仅显示前 24 门，请继续输入以缩小范围。</p>}
                <CourseTable courses={displayedCourses} completed={completed} onToggle={toggleCourse} onResetFilters={() => {
                  setQuery('')
                  setSelectedModule(null)
                  setPreferences({ ...preferences, semester: 0 })
                }} />
              </>
            ) : (
              <div className="module-empty">
                <Search aria-hidden="true" size={30} strokeWidth={1.4} />
                <h3>按模块查看，或直接检索</h3>
                <p>主页不展示全部课程。点击左侧具体模块查看可选课程，也可以输入课程名称或编码快速录入。</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div><strong>学业规划平台</strong><span>课程数据来自数智人大平台-统计学院培养方案。</span></div>
        <p>已修记录保存在此浏览器中，不会跨设备同步；清除浏览器数据前请先导出备份。</p>
        <button type="button" className="danger-text-button" disabled={!completedCount} onClick={() => setClearOpen(true)}>
          <Trash2 aria-hidden="true" size={15} />清空已修记录
        </button>
      </footer>

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        rows={reviewRows}
        courses={majorCourses}
        fileName={fileName}
        onRowsChange={setReviewRows}
        onConfirm={confirmImport}
      />

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="confirm-dialog">
          <DialogHeader>
            <DialogTitle>清空全部已修记录？</DialogTitle>
            <DialogDescription>此操作会移除当前浏览器中的 {completedCount} 门已修课程，且无法撤销。建议先导出备份。</DialogDescription>
          </DialogHeader>
          <div className="confirm-actions">
            <button type="button" className="secondary-button" onClick={() => setClearOpen(false)}>取消</button>
            <button type="button" className="danger-button" onClick={() => { setCompleted({}); setClearOpen(false); notify('已修记录已清空') }}>确认清空</button>
          </div>
        </DialogContent>
      </Dialog>

      {toast && <div className="toast" role="status"><CheckCircle2 aria-hidden="true" size={18} />{toast}</div>}
    </div>
  )
}
