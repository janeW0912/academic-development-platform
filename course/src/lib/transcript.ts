import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { Course, PassStatus, TranscriptRow } from '../types'

type Cell = string | number
type TableRow = Cell[]

const NAME_HEADERS = ['课程名称', '课程名', '课程', '名称']
const CODE_HEADERS = ['课程编码', '课程代码', '课程号', '课号', '代码']
const CREDIT_HEADERS = ['学分', '课程学分']
const SCORE_HEADERS = ['成绩', '总评成绩', '最终成绩', '分数', '综合成绩']
const SEMESTER_HEADERS = ['开课学期', '修读学期', '学期']

const cellText = (value: Cell | undefined) => String(value ?? '').trim()
const headerText = (value: Cell | undefined) => cellText(value).replace(/[\s（）()]/g, '')

export function normalizeCourseName(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '')
    .replace(/[（(]含[^）)]*学时实践[^）)]*[）)]/g, '')
    .replace(/[ⅠⅡⅢⅣⅤ]/g, (roman) => ({ 'Ⅰ': 'I', 'Ⅱ': 'II', 'Ⅲ': 'III', 'Ⅳ': 'IV', 'Ⅴ': 'V' })[roman] ?? roman)
    .replace(/[\s·•—_\-（）()【】[\]：:，,。.]/g, '')
    .toUpperCase()
}

function findHeaderIndex(row: TableRow, candidates: string[]) {
  return row.findIndex((cell) => candidates.includes(headerText(cell)))
}

function rowsToTranscript(rows: TableRow[]): TranscriptRow[] {
  let headerRowIndex = -1
  let nameIndex = -1
  let codeIndex = -1
  let scoreIndex = -1

  for (let index = 0; index < Math.min(rows.length, 25); index += 1) {
    const row = rows[index]
    const possibleName = findHeaderIndex(row, NAME_HEADERS)
    const possibleCode = findHeaderIndex(row, CODE_HEADERS)
    const possibleScore = findHeaderIndex(row, SCORE_HEADERS)
    if (possibleName >= 0 && (possibleCode >= 0 || possibleScore >= 0)) {
      headerRowIndex = index
      nameIndex = possibleName
      codeIndex = possibleCode
      scoreIndex = possibleScore
      break
    }
  }

  if (headerRowIndex < 0) return fallbackRows(rows)

  const header = rows[headerRowIndex]
  const creditIndex = findHeaderIndex(header, CREDIT_HEADERS)
  const semesterIndex = findHeaderIndex(header, SEMESTER_HEADERS)
  const result: TranscriptRow[] = []

  rows.slice(headerRowIndex + 1).forEach((row, index) => {
    const rawName = cellText(row[nameIndex])
    if (!rawName || NAME_HEADERS.includes(headerText(rawName))) return
    if (/^(合计|总计|学分统计|成绩统计|备注|说明)/.test(rawName)) return
    const code = codeIndex >= 0 ? cellText(row[codeIndex]) : ''
    const score = scoreIndex >= 0 ? cellText(row[scoreIndex]) : ''
    const credits = creditIndex >= 0 ? cellText(row[creditIndex]) : ''
    const semester = semesterIndex >= 0 ? cellText(row[semesterIndex]) : ''
    if (!code && !score && !credits && rawName.length < 2) return
    result.push(makeRow(rawName, code, score, credits, semester, index))
  })

  return result
}

function fallbackRows(rows: TableRow[]): TranscriptRow[] {
  const result: TranscriptRow[] = []
  rows.forEach((row, index) => {
    const texts = row.map(cellText)
    const code = texts.find((cell) => /^[A-Z][A-Z0-9]{6,}$/i.test(cell)) ?? ''
    if (!code) return
    const name = texts
      .filter((cell) => /[\u4e00-\u9fff]/.test(cell) && cell !== code)
      .sort((a, b) => b.length - a.length)[0] ?? ''
    if (!name || NAME_HEADERS.includes(headerText(name))) return
    const score = texts.find((cell) => /^(\d{1,3}(?:\.\d+)?|优秀|良好|中等|合格|通过|不合格|不及格)$/.test(cell)) ?? ''
    result.push(makeRow(name, code, score, '', '', index))
  })
  return result
}

function makeRow(rawName: string, code: string, score: string, credits: string, semester: string, index: number): TranscriptRow {
  return {
    id: `transcript-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    rawName: rawName.replace(/<br\s*\/?>/gi, '').trim(),
    code: code.trim().toUpperCase(),
    score: score.trim(),
    credits: credits.trim(),
    semester: semester.trim(),
    matchId: '',
    matchType: '',
    passStatus: getPassStatus(score),
    selected: false,
    issue: '',
  }
}

export function getPassStatus(score: string): PassStatus {
  const value = score.trim()
  if (!value) return 'unknown'
  if (/不合格|不及格|未通过|缺考|缓考|弃考|作弊/.test(value)) return 'failed'
  if (/^(?:\d{1,3}(?:\.\d+)?)$/.test(value)) return Number(value) >= 60 ? 'passed' : 'failed'
  if (/合格|通过|优秀|良好|中等|及格|免修|免考/.test(value)) return 'passed'
  return 'unknown'
}

export function matchTranscriptRows(rows: TranscriptRow[], courses: Course[]): TranscriptRow[] {
  const codeMap = new Map<string, Course[]>()
  const nameMap = new Map<string, Course[]>()
  const addToMap = (map: Map<string, Course[]>, key: string, course: Course) => {
    if (!key) return
    const current = map.get(key) ?? []
    map.set(key, [...current, course])
  }

  courses.forEach((course) => {
    course.codes.forEach((code) => addToMap(codeMap, code.toUpperCase(), course))
    ;[course.name, ...course.aliases].forEach((name) => addToMap(nameMap, normalizeCourseName(name), course))
  })

  const seen = new Set<string>()
  return rows.map((row) => {
    const codeCandidates = codeMap.get(row.code) ?? []
    const normalizedName = normalizeCourseName(row.rawName)
    const nameCandidates = nameMap.get(normalizedName) ?? []
    let matched = codeCandidates.length === 1 ? codeCandidates[0] : undefined
    let matchType: TranscriptRow['matchType'] = matched ? 'code' : ''

    if (!matched && codeCandidates.length > 1) {
      matched = codeCandidates.find((course) => normalizeCourseName(course.name) === normalizedName)
      if (matched) matchType = 'code'
    }
    if (!matched && nameCandidates.length > 0) {
      matched = nameCandidates[0]
      matchType = 'name'
    }

    if (!matched) {
      return { ...row, issue: row.passStatus === 'failed' ? '未匹配课程，且成绩未通过' : '未在培养方案中找到对应课程' }
    }

    let issue = ''
    let selected = row.passStatus !== 'failed'
    if (row.passStatus === 'failed') issue = '成绩未通过，不自动记为已修'
    else if (row.passStatus === 'unknown') issue = '未识别到明确成绩，请核对后导入'
    if (seen.has(matched.id)) {
      selected = false
      issue = '与上一条记录重复，请核对'
    }
    seen.add(matched.id)

    return { ...row, matchId: matched.id, matchType, selected, issue }
  })
}

async function extractPdfRows(file: File): Promise<TableRow[]> {
  const [pdfjsLib, { default: pdfWorker }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
  const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const rows: TableRow[] = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const items = content.items.filter((item): item is TextItem => 'str' in item && Boolean(item.str.trim()))
    const lines = new Map<number, TextItem[]>()

    items.forEach((item) => {
      const y = Math.round(item.transform[5] / 3) * 3
      const existing = lines.get(y) ?? []
      lines.set(y, [...existing, item])
    })

    Array.from(lines.entries())
      .sort(([a], [b]) => b - a)
      .forEach(([, lineItems]) => {
        const row = lineItems
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map((item) => item.str.trim())
          .filter(Boolean)
        if (row.length) rows.push(row)
      })
  }
  return rows
}

export async function parseTranscriptFile(file: File): Promise<TranscriptRow[]> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!['xlsx', 'xls', 'csv', 'pdf'].includes(extension ?? '')) {
    throw new Error('暂不支持此格式，请上传 XLSX、XLS、CSV 或文本型 PDF 成绩单。')
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('文件超过 15MB，请压缩后再试。')
  }

  let rows: TranscriptRow[]
  if (extension === 'pdf') {
    rows = rowsToTranscript(await extractPdfRows(file))
  } else {
    const XLSX = await import('xlsx')
    const workbook = extension === 'csv'
      ? XLSX.read(await file.text(), { type: 'string' })
      : XLSX.read(await file.arrayBuffer(), { type: 'array' })
    rows = workbook.SheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      const table = XLSX.utils.sheet_to_json<TableRow>(sheet, { header: 1, defval: '', raw: false })
      return rowsToTranscript(table)
    })
  }

  if (!rows.length) {
    throw new Error(extension === 'pdf'
      ? '没有识别到课程记录。请确认 PDF 可复制文字，或改用 Excel／CSV 成绩单。'
      : '没有识别到课程记录，请检查是否包含“课程名称”和“课程编码／成绩”列。')
  }
  return rows
}

export function createDemoRows(): TranscriptRow[] {
  const demo = [
    ['数学分析 I', 'BBSMMSB003', '88', '5', '2025-2026-1'],
    ['高等代数 I', 'BBSMMSB001', '92', '4', '2025-2026-1'],
    ['程序设计 I：C 语言', 'BCSTMSB001S', '85', '4', '2025-2026-1'],
    ['统计学概论', 'BSTAMS0030S', '90', '2', '2025-2026-1'],
    ['概率论', 'BPTMMSB001', '58', '4', '2025-2026-2'],
    ['大学英语综合 A', 'BELLCEA003', '82', '2', '2025-2026-1'],
    ['太极拳', 'BCPEQD0002', '合格', '1', '2025-2026-1'],
    ['校外暑期研讨', '', '90', '2', '2025-2026-2'],
  ]
  return demo.map((row, index) => makeRow(row[0], row[1], row[2], row[3], row[4], index))
}

export async function downloadTranscriptTemplate() {
  const XLSX = await import('xlsx')
  const rows = [
    { 课程名称: '数学分析 I', 课程编码: 'BBSMMSB003', 学分: 5, 成绩: 88, 开课学期: '2025-2026-1' },
    { 课程名称: '统计学概论', 课程编码: 'BSTAMS0030S', 学分: 2, 成绩: 90, 开课学期: '2025-2026-1' },
  ]
  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 20 }]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '成绩单')
  XLSX.writeFile(workbook, '成绩单导入模板.xlsx')
}
