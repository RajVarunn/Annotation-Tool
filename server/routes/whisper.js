import express from 'express'
import { upload } from '../config/multer.js'
import OpenAI from 'openai'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import axios from 'axios'
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

// Initialize ElevenLabs client - will be created when needed
let elevenLabsClient = null

const getElevenLabsClient = () => {
  if (!elevenLabsClient) {
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY not configured')
    }
    elevenLabsClient = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY
    })
  }
  return elevenLabsClient
}

/**
 * POST /api/whisper/transcribe
 * Transcribe audio from video using selected AI model
 */
router.post('/transcribe', upload.single('video'), async (req, res) => {
  let audioPath = null
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' })
    }

    const videoPath = req.file.path
    const model = req.body.model || 'whisper' // Default to whisper if not specified
    console.log('Processing video:', videoPath)
    console.log('Using model:', model)

    // Extract audio from video
    console.log('Extracting audio...')
    audioPath = await extractAudio(videoPath)
    console.log('Audio extracted:', audioPath)

    // Get OpenAI client
    const client = getOpenAIClient()

    let transcription, translationText, summaryText, detectedLanguage, duration, originalTranscription

    // Process based on selected model
    switch (model) {
      case 'whisper':
        // Original Whisper implementation
        console.log('Transcribing with Whisper...')
        transcription = await client.audio.transcriptions.create({
          file: fs.createReadStream(audioPath),
          model: 'whisper-1',
          response_format: 'verbose_json',
        })
        
        detectedLanguage = transcription.language
        duration = transcription.duration
        console.log('Transcription complete. Detected language:', detectedLanguage)

        // Translate to English if needed
        translationText = transcription.text
        if (detectedLanguage !== 'en' && detectedLanguage !== 'english') {
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
        break

      case 'elevenlabs':
        // ElevenLabs Speech-to-Text API implementation
        console.log('Transcribing with ElevenLabs Speech-to-Text...')
        
        if (!process.env.ELEVENLABS_API_KEY) {
          console.log('ElevenLabs API key not found, falling back to Whisper')
          transcription = await client.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: 'whisper-1',
            response_format: 'verbose_json',
          })
          detectedLanguage = transcription.language
          duration = transcription.duration
          translationText = transcription.text
        } else {
          try {
            console.log('Calling ElevenLabs Speech-to-Text API...')
            
            // Import FormData dynamically (ES module)
            const FormData = (await import('form-data')).default
            const formData = new FormData()
            
            // Append the audio file as a stream (parameter name must be 'file')
            formData.append('file', fs.createReadStream(audioPath), {
              filename: path.basename(audioPath),
              contentType: 'audio/mpeg',
            })
            
            // Append model_id
            formData.append('model_id', 'scribe_v1')
            
            console.log(`Sending audio file: ${path.basename(audioPath)}`)
            
            // Make request to ElevenLabs Speech-to-Text API using axios
            const response = await axios.post(
              'https://api.elevenlabs.io/v1/speech-to-text',
              formData,
              {
                headers: {
                  'xi-api-key': process.env.ELEVENLABS_API_KEY,
                  ...formData.getHeaders(),
                },
              }
            )
            
            const result = response.data
            console.log('ElevenLabs response received')
            
            // Extract transcription data from the result
            const originalText = result.text || ''
            originalTranscription = originalText  // Store the original Tamil text
            detectedLanguage = result.language_code || 'unknown'
            const languageProbability = result.language_probability || 0
            
            console.log(`ElevenLabs transcription complete.`)
            console.log(`Language: ${detectedLanguage} (confidence: ${languageProbability})`)
            console.log(`Original text length: ${originalText.length} characters`)
            
            // Translate to English using GPT-4o-mini if not already in English
            if (detectedLanguage && detectedLanguage !== 'en' && detectedLanguage !== 'english' && detectedLanguage !== 'unknown') {
              console.log(`Translating from ${detectedLanguage} to English with GPT-4o-mini...`)
              const translation = await client.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a professional translator. Translate the following text to English accurately. Only provide the translation, no explanations or additional text.'
                  },
                  {
                    role: 'user',
                    content: originalText
                  }
                ],
              })
              translationText = translation.choices[0].message.content
              console.log('Translation to English complete')
            } else {
              if (detectedLanguage === 'en' || detectedLanguage === 'english') {
                console.log('Audio is already in English, skipping translation')
              } else {
                console.log('Language unknown, using original text without translation')
              }
              translationText = originalText
            }
            
            // Calculate duration if available
            if (result.duration) {
              duration = result.duration
            } else if (result.audio_length) {
              duration = result.audio_length
            } else if (result.words && result.words.length > 0) {
              const lastWord = result.words[result.words.length - 1]
              duration = lastWord.end || 0
            }
            
            if (duration) {
              console.log(`Duration: ${duration}s`)
            }
          } catch (elevenLabsError) {
            console.error('ElevenLabs API error, falling back to Whisper:', elevenLabsError.message)
            if (elevenLabsError.response?.data) {
              console.error('Error response:', elevenLabsError.response.data)
            }
            transcription = await client.audio.transcriptions.create({
              file: fs.createReadStream(audioPath),
              model: 'whisper-1',
              response_format: 'verbose_json',
            })
            detectedLanguage = transcription.language
            duration = transcription.duration
            translationText = transcription.text
          }
        }
        break

      default:
        throw new Error(`Unsupported model: ${model}`)
    }

    // Generate summary using GPT (on the English version)
    console.log('Generating summary...')
    const summary = await client.chat.completions.create({
      model: 'gpt-4o',
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

    summaryText = summary.choices[0].message.content

    // Clean up files
    fs.unlinkSync(videoPath)
    fs.unlinkSync(audioPath)

    // Return results
    res.json({
      transcription: transcription?.text || originalTranscription || translationText,
      translation: translationText,
      summary: summaryText,
      language: detectedLanguage,
      duration: duration,
      model: model,
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
