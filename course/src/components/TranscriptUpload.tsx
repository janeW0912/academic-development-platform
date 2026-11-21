import { useRef, useState } from 'react'
import { ArrowDownToLine, FileUp, LoaderCircle, Play, ShieldCheck, Upload } from 'lucide-react'
import { downloadTranscriptTemplate } from '../lib/transcript'

interface TranscriptUploadProps {
  isParsing: boolean
  catalogReady: boolean
  error: string
  onFile: (file: File) => void
  onDemo: () => void
}

export default function TranscriptUpload({ isParsing, catalogReady, error, onFile, onDemo }: TranscriptUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const receiveFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file && catalogReady && !isParsing) onFile(file)
  }

  return (
    <section id="upload" className="upload-panel" aria-labelledby="upload-title">
      <div className="upload-heading">
        <div>
          <span className="section-index">成绩单导入</span>
          <h2 id="upload-title">自动检索已修课程</h2>
        </div>
        <FileUp aria-hidden="true" size={28} strokeWidth={1.5} />
      </div>

      <div
        className={`drop-zone${dragging ? ' is-dragging' : ''}${isParsing ? ' is-loading' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { event.preventDefault(); setDragging(false) }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          receiveFiles(event.dataTransfer.files)
        }}
      >
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          aria-label="选择成绩单文件"
          disabled={!catalogReady || isParsing}
          onChange={(event) => {
            receiveFiles(event.target.files)
            event.target.value = ''
          }}
        />
        {isParsing ? <LoaderCircle className="spin" aria-hidden="true" size={30} /> : <Upload aria-hidden="true" size={30} strokeWidth={1.5} />}
        <p>{isParsing ? '正在读取成绩单并检索课程…' : '拖入成绩单，或从电脑中选择'}</p>
        <span>XLSX / XLS / CSV / 文本型 PDF，最大 15MB</span>
        <button className="primary-button" type="button" disabled={!catalogReady || isParsing} onClick={() => inputRef.current?.click()}>
          {isParsing ? '正在解析' : '选择成绩单'}
        </button>
      </div>

      <div className="upload-feedback" aria-live="polite">
        {error && <p className="error-message">{error}</p>}
      </div>

      <div className="upload-actions">
        <button type="button" className="text-button" onClick={() => { void downloadTranscriptTemplate() }}>
          <ArrowDownToLine aria-hidden="true" size={16} />下载导入模板
        </button>
        <button type="button" className="text-button" onClick={onDemo} disabled={!catalogReady || isParsing}>
          <Play aria-hidden="true" size={15} />试用示例成绩单
        </button>
      </div>

      <div className="privacy-note">
        <ShieldCheck aria-hidden="true" size={18} />
        <p>文件仅在当前浏览器本地解析，不会上传服务器。从微人大导出的成绩单需在 WPS 中转为 XLSX 格式再上传；扫描图片型 PDF 请先转为 Excel 或 CSV。</p>
      </div>
    </section>
  )
}
