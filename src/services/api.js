import axios from 'axios'

const API_BASE_URL = '/api'

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes timeout for video processing
})

/**
 * Transcribe video audio using selected AI model
 * @param {File} videoFile - The video file to transcribe
 * @param {string} model - The transcription model to use ('whisper', 'gpt-4o-mini', 'elevenlabs', 'chatterbox')
 * @returns {Promise<Object>} - Transcription results
 */
export const transcribeVideo = async (videoFile, model = 'whisper') => {
  try {
    const formData = new FormData()
    formData.append('video', videoFile)
    formData.append('model', model)

    const response = await api.post('/whisper/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data
  } catch (error) {
    console.error('Error transcribing video:', error)
    throw new Error(
      error.response?.data?.error || 
      error.message || 
      'Failed to transcribe video'
    )
  }
}

/**
 * Extract text from video frames using OCR
 * @param {File} videoFile - The video file to extract text from
 * @returns {Promise<Object>} - OCR results
 */
export const extractTextFromVideo = async (videoFile) => {
  try {
    const formData = new FormData()
    formData.append('video', videoFile)

    const response = await api.post('/ocr/extract', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data
  } catch (error) {
    console.error('Error extracting text from video:', error)
    throw new Error(
      error.response?.data?.error || 
      error.message || 
      'Failed to extract text from video'
    )
  }
}

export default api
