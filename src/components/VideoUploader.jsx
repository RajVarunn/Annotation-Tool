import { useState, useRef } from 'react'
import './VideoUploader.css'

function VideoUploader({ onVideoUpload }) {
  const [dragActive, setDragActive] = useState(false)
  const [fileName, setFileName] = useState('')
  const inputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  const handleFile = (file) => {
    // Check if it's a video file
    if (!file.type.startsWith('video/')) {
      alert('Please upload a valid video file')
      return
    }

    // Check file size (limit to 100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      alert('File size must be less than 100MB')
      return
    }

    setFileName(file.name)
    onVideoUpload(file)
  }

  const onButtonClick = () => {
    inputRef.current.click()
  }

  return (
    <div className="video-uploader">
      <form 
        className={`upload-form ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          className="input-file"
          accept="video/*"
          onChange={handleChange}
        />
        
        <div className="upload-content">
          <div className="upload-icon">🎥</div>
          <p className="upload-text">
            {fileName ? (
              <>
                <strong>Selected:</strong> {fileName}
              </>
            ) : (
              <>
                Drag and drop your video here, or{' '}
                <span className="upload-link" onClick={onButtonClick}>
                  browse
                </span>
              </>
            )}
          </p>
          <p className="upload-hint">Supports MP4, WebM, and other video formats (max 100MB)</p>
          
          {!fileName && (
            <button 
              type="button" 
              className="upload-button"
              onClick={onButtonClick}
            >
              Choose Video File
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default VideoUploader
