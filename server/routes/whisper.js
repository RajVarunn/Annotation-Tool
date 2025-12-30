import express from 'express'
import { upload } from '../config/multer.js'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extractAudio } from '../utils/audioExtractor.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Initialize OpenAI client - will be created when needed
let openai = null

const getOpenAIClient = () => {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set. Please add it to your .env file.')
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }
  return openai
}

/**
 * POST /api/whisper/transcribe
 * Transcribe audio from video using OpenAI Whisper
 */
router.post('/transcribe', upload.single('video'), async (req, res) => {
  let audioPath = null
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' })
    }

    const videoPath = req.file.path
    console.log('Processing video:', videoPath)

    // Extract audio from video
    console.log('Extracting audio...')
    audioPath = await extractAudio(videoPath)
    console.log('Audio extracted:', audioPath)

    // Get OpenAI client
    const client = getOpenAIClient()

    // Transcribe with Whisper (in original language)
    console.log('Transcribing with Whisper...')
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      // language parameter omitted for automatic language detection
      // To force a specific language, add: language: 'en' (or 'es', 'fr', etc.)
      response_format: 'verbose_json',
    })

    console.log('Transcription complete. Detected language:', transcription.language)

    // Translate to English using Whisper's translation API
    let translationText = transcription.text
    if (transcription.language !== 'en' && transcription.language !== 'english') {
      console.log('Translating to English...')
      const translation = await client.audio.translations.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
      })
      translationText = translation.text
      console.log('Translation complete')
    } else {
      console.log('Audio is already in English, skipping translation')
    }

    // Generate summary using GPT (on the English version)
    console.log('Generating summary...')
    const summary = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that summarizes video transcriptions. Provide a concise summary of what is happening in the video based on the audio transcription.'
        },
        {
          role: 'user',
          content: `Please summarize this video transcription: ${translationText}`
        }
      ],
      max_tokens: 150,
    })

    const summaryText = summary.choices[0].message.content

    // Clean up files
    fs.unlinkSync(videoPath)
    fs.unlinkSync(audioPath)

    // Return results
    res.json({
      transcription: transcription.text,
      translation: translationText,
      summary: summaryText,
      language: transcription.language,
      duration: transcription.duration,
    })

  } catch (error) {
    console.error('Error in transcription:', error)
    
    // Clean up files on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    if (audioPath && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath)
    }

    res.status(500).json({ 
      error: error.message || 'Failed to transcribe video',
      details: error.response?.data || error.toString()
    })
  }
})

export default router
