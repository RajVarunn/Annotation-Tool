import { useState, useRef } from 'react'
import './VoiceRecorder.css'

function VoiceRecorder({ onRecordingComplete, isProcessing }) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        onRecordingComplete(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      clearInterval(timerRef.current)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="voice-recorder">
      {!isRecording ? (
        <button 
          onClick={startRecording} 
          disabled={isProcessing}
          className="record-button"
        >
          🎙️ Start Recording
        </button>
      ) : (
        <div className="recording-controls">
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            <span>Recording... {formatTime(recordingTime)}</span>
          </div>
          <button 
            onClick={stopRecording}
            className="stop-button"
          >
            ⏹️ Stop Recording
          </button>
        </div>
      )}
      {isProcessing && <p className="processing-text">Processing your voice...</p>}
    </div>
  )
}

export default VoiceRecorder
