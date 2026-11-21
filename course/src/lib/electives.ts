import type { Course, ElectiveRule } from '../types'

export const SCIENCE_MAJOR = '数据科学与大数据技术'
export const ENGINEERING_MAJOR = '数据科学与大数据技术（工学）'
export const BIOMEDICAL_MAJOR = '应用统计学（生物医学方向）'
export const ELECTIVE_MODULE = '个性化选修'
export const FOUNDATION_COMMON = '部类共同课'
export const FOUNDATION_BASIC = '部类基础课'

const GROUP_NAMES: Record<number, string> = {
  10: '计算机类专业实践',
  11: '复杂工程实践',
  12: '计算机理论基础',
  13: '系统与网络',
  14: '人工智能',
  15: '大数据技术',
  16: '多媒体技术',
  24: '概率统计进阶',
  25: '数据科学进阶',
  26: '风险精算进阶',
  27: '经济统计进阶',
  28: '一般统计、算法模型方法',
  30: '统计学类基础课',
  31: '经济社会学类基础课',
}

export function electiveRuleLabel(rule: ElectiveRule, names?: Record<number, string>) {
  if (names) return rule.groups.map((group) => names[group]).join(' / ')
  return rule.groups.map((group) => `${group} ${GROUP_NAMES[group]}`).join(' / ')
}

export function matchesElectiveRule(course: Course, rule: ElectiveRule) {
  return rule.groups.some((group) => course.electiveGroups?.includes(group))
}

export function electiveNature(course: Course) {
  return course.electiveKind === 'limited' ? '模块限选课' : '个性化任选课'
}
