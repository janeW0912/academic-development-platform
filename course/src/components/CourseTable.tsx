import { Check, SearchX } from 'lucide-react'
import { displayModuleName } from '../lib/curriculum'
import { electiveNature } from '../lib/electives'
import type { CompletedRecord, Course } from '../types'

interface CourseTableProps {
  courses: Course[]
  completed: Record<string, CompletedRecord>
  onToggle: (courseId: string) => void
  onResetFilters: () => void
}

export default function CourseTable({ courses, completed, onToggle, onResetFilters }: CourseTableProps) {
  if (!courses.length) {
    return (
      <div className="empty-state">
        <SearchX aria-hidden="true" size={30} strokeWidth={1.4} />
        <h3>没有找到符合条件的课程</h3>
        <p>可以更换关键词、切换学期，或清除筛选。</p>
        <button type="button" className="secondary-button" onClick={onResetFilters}>清除筛选</button>
      </div>
    )
  }

  return (
    <div className="course-table-wrap">
      <table className="course-table">
        <caption className="sr-only">培养方案课程与已修状态</caption>
        <thead>
          <tr>
            <th scope="col">状态</th>
            <th scope="col">课程名称／编码</th>
            <th scope="col">课程模块</th>
            <th scope="col">学分</th>
            <th scope="col">开课学期</th>
            <th scope="col">成绩／来源</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => {
            const record = completed[course.id]
            return (
              <tr key={course.id} className={record ? 'is-complete' : ''}>
                <td data-label="状态">
                  <label className="course-check" title={record ? '取消已修标记' : '标记为已修'}>
                    <input
                      type="checkbox"
                      checked={Boolean(record)}
                      onChange={() => onToggle(course.id)}
                      aria-label={`${record ? '取消' : '标记'} ${course.name} 为已修`}
                    />
                    <span aria-hidden="true">{record && <Check size={15} strokeWidth={2.5} />}</span>
                  </label>
                </td>
                <td data-label="课程">
                  <div className="course-name">{course.name}</div>
                  <div className="course-code">{course.codes.join(' / ') || '培养方案未提供编码'}</div>
                </td>
                <td data-label="模块"><span className="module-name">{course.electiveKind ? electiveNature(course) : displayModuleName(course.modules[0])}</span></td>
                <td data-label="学分"><span className="numeric">{course.creditsLabel}</span></td>
                <td data-label="学期"><span className="semester">{course.semester}</span></td>
                <td data-label="成绩">
                  {record ? (
                    <div className="record-meta">
                      <strong>{record.score || '已修'}</strong>
                      <span>{record.source}</span>
                    </div>
                  ) : <span className="not-complete">未修</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
