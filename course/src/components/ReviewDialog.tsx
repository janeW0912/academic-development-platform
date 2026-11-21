import { useMemo, useState } from 'react'
import { AlertCircle, Check, FileCheck2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Course, TranscriptRow } from '../types'

interface ReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: TranscriptRow[]
  courses: Course[]
  fileName: string
  onRowsChange: (rows: TranscriptRow[]) => void
  onConfirm: () => void
}

export default function ReviewDialog({ open, onOpenChange, rows, courses, fileName, onRowsChange, onConfirm }: ReviewDialogProps) {
  const [filter, setFilter] = useState<'all' | 'attention'>('all')
  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses])
  const matchedCount = rows.filter((row) => row.matchId).length
  const selectedCount = rows.filter((row) => row.selected && row.matchId && row.passStatus !== 'failed').length
  const attentionCount = rows.filter((row) => !row.matchId || row.issue).length
  const visibleRows = filter === 'all' ? rows : rows.filter((row) => !row.matchId || row.issue)

  const updateRow = (id: string, update: Partial<TranscriptRow>) => {
    onRowsChange(rows.map((row) => row.id === id ? { ...row, ...update } : row))
  }

  const setManualMatch = (row: TranscriptRow, courseId: string) => {
    updateRow(row.id, {
      matchId: courseId,
      matchType: courseId ? 'manual' : '',
      selected: Boolean(courseId) && row.passStatus !== 'failed',
      issue: !courseId
        ? '未在培养方案中找到对应课程'
        : row.passStatus === 'failed'
          ? '成绩未通过，不自动记为已修'
          : row.passStatus === 'unknown'
            ? '未识别到明确成绩，请核对后导入'
            : '',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="review-dialog" showCloseButton>
        <DialogHeader className="review-header">
          <span className="section-index">导入前确认</span>
          <DialogTitle>检索到 {matchedCount} 门对应课程</DialogTitle>
          <DialogDescription>{fileName} · 共读取 {rows.length} 条成绩记录，请核对后写入学业进度。</DialogDescription>
        </DialogHeader>

        <div className="review-summary" aria-label="成绩单解析摘要">
          <div><strong>{rows.length}</strong><span>读取记录</span></div>
          <div><strong>{matchedCount}</strong><span>匹配课程</span></div>
          <div><strong>{attentionCount}</strong><span>需要核对</span></div>
        </div>

        <div className="review-toolbar">
          <div className="segmented-control" aria-label="审查记录筛选">
            <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部记录</button>
            <button type="button" className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>仅看待核对 {attentionCount}</button>
          </div>
          <span>勾选后才会导入</span>
        </div>

        <div className="review-list">
          {visibleRows.length === 0 && (
            <div className="review-empty"><Check size={24} />所有记录均已匹配，无需额外处理。</div>
          )}
          {visibleRows.map((row) => {
            const course = courseMap.get(row.matchId)
            const disabled = !row.matchId || row.passStatus === 'failed'
            return (
              <article className={`review-row${row.issue ? ' has-issue' : ''}`} key={row.id}>
                <label className="review-check">
                  <input
                    type="checkbox"
                    checked={row.selected && !disabled}
                    disabled={disabled}
                    aria-label={`导入 ${row.rawName}`}
                    onChange={(event) => updateRow(row.id, { selected: event.target.checked })}
                  />
                </label>
                <div className="review-course">
                  <div className="review-source-line">
                    <strong>{row.rawName}</strong>
                    <span>{row.code || '无课程编码'}</span>
                  </div>
                  {course ? (
                    <div className="match-result">
                      <FileCheck2 aria-hidden="true" size={15} />
                      <span>{course.name}</span>
                      <small>{row.matchType === 'code' ? '编码匹配' : row.matchType === 'name' ? '名称匹配' : '人工匹配'}</small>
                    </div>
                  ) : (
                    <select
                      aria-label={`为 ${row.rawName} 选择对应课程`}
                      value={row.matchId}
                      onChange={(event) => setManualMatch(row, event.target.value)}
                    >
                      <option value="">不导入／选择对应课程</option>
                      {courses.map((option) => (
                        <option key={option.id} value={option.id}>{option.name} · {option.codes[0] || '无编码'}</option>
                      ))}
                    </select>
                  )}
                  {row.issue && <p className="row-issue"><AlertCircle aria-hidden="true" size={14} />{row.issue}</p>}
                </div>
                <div className="review-score">
                  <strong>{row.score || '—'}</strong>
                  <span>{row.credits ? `${row.credits} 学分` : '成绩'}</span>
                </div>
              </article>
            )
          })}
        </div>

        <div className="review-footer">
          <p>将导入 <strong>{selectedCount}</strong> 门课程；未通过成绩不会计入。</p>
          <div>
            <button type="button" className="secondary-button" onClick={() => onOpenChange(false)}>返回修改</button>
            <button type="button" className="primary-button" disabled={!selectedCount} onClick={onConfirm}>确认导入 {selectedCount} 门</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
