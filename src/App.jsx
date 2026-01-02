import { useState } from 'react'
import './App.css'
import VideoUploader from './components/VideoUploader'
import VideoPlayer from './components/VideoPlayer'
import ResultsDisplay from './components/ResultsDisplay'
import { transcribeVideo, extractTextFromVideo } from './services/api'

function App() {
  const [videoFile, setVideoFile] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [transcriptionResult, setTranscriptionResult] = useState(null)
  const [ocrResult, setOcrResult] = useState(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState(null)
  const [selectedModel, setSelectedModel] = useState('whisper')

  const handleVideoUpload = (file) => {
    setVideoFile(file)
    setVideoUrl(URL.createObjectURL(file))
    setTranscriptionResult(null)
    setOcrResult(null)
    setError(null)
  }

  const handleTranscribe = async () => {
    if (!videoFile) {
      setError('Please upload a video first')
      return
    }

    setIsTranscribing(true)
    setError(null)
    setTranscriptionResult(null)

    try {
      const result = await transcribeVideo(videoFile, selectedModel)
      setTranscriptionResult(result)
    } catch (err) {
      setError(`Transcription error: ${err.message}`)
      console.error('Transcription error:', err)
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleOCR = async () => {
    if (!videoFile) {
      setError('Please upload a video first')
      return
    }

    setIsExtracting(true)
    setError(null)
    setOcrResult(null)

    try {
      const result = await extractTextFromVideo(videoFile)
      setOcrResult(result)
    } catch (err) {
      setError(`OCR error: ${err.message}`)
      console.error('OCR error:', err)
    } finally {
      setIsExtracting(false)
    }
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎬 Video Annotation Tool</h1>
        <p>Upload a video, transcribe audio with multiple AI models, or extract text with OCR</p>
      </header>

      <main className="App-main">
        <div className="upload-section">
          <VideoUploader onVideoUpload={handleVideoUpload} />
        </div>

        {videoUrl && (
          <div className="video-section">
            <VideoPlayer videoUrl={videoUrl} />
            
            <div className="model-selector">
              <label htmlFor="model-select">Select Transcription Model:</label>
              <select 
                id="model-select"
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isTranscribing || isExtracting}
              >
                <option value="whisper">OpenAI Whisper</option>
                <option value="elevenlabs">ElevenLabs Scribe V1</option>
              </select>
            </div>
            
            <div className="action-buttons">
              <button 
                onClick={handleTranscribe} 
                disabled={isTranscribing || isExtracting}
                className="primary-button"
              >
                {isTranscribing ? '🔄 Transcribing...' : `🎙️ Transcribe Audio with ${selectedModel === 'whisper' ? 'Whisper' : selectedModel === 'elevenlabs' ? 'ElevenLabs': `Selected Model`}`}
              </button>
              
              <button 
                onClick={handleOCR} 
                disabled={isExtracting || isTranscribing}
                className="secondary-button"
              >
                {isExtracting ? '🔄 Extracting Text...' : '📝 Extract Text with OCR'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>❌ {error}</p>
          </div>
        )}

        <ResultsDisplay 
          transcriptionResult={transcriptionResult}
          ocrResult={ocrResult}
        />
      </main>
    </div>
  )
}

export default App
