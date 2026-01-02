import express from 'express'
import { upload, uploadAudio } from '../config/multer.js'
import OpenAI from 'openai'
import { AssemblyAI } from 'assemblyai'
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

// Initialize AssemblyAI client - will be created when needed
let assemblyAIClient = null

const getAssemblyAIClient = () => {
  if (!assemblyAIClient) {
    if (!process.env.ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY not configured')
    }
    assemblyAIClient = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY
    })
  }
  return assemblyAIClient
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

      case 'assemblyai':
        // AssemblyAI implementation
        console.log('Transcribing with AssemblyAI...')
        
        if (!process.env.ASSEMBLYAI_API_KEY) {
          console.log('AssemblyAI API key not found, falling back to Whisper')
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
            console.log('Uploading audio to AssemblyAI...')
            const assemblyai = getAssemblyAIClient()
            
            // Transcribe the audio file
            const transcript = await assemblyai.transcripts.transcribe({
              audio: audioPath,
              language_detection: true,  // Auto-detect language
            })
            
            console.log('AssemblyAI transcription complete')
            
            // Extract data
            originalTranscription = transcript.text
            detectedLanguage = transcript.language_code || 'unknown'
            duration = transcript.audio_duration || 0
            
            console.log(`Language: ${detectedLanguage}`)
            console.log(`Confidence: ${transcript.confidence || 'N/A'}`)
            console.log(`Duration: ${duration}s`)
            
            // Translate to English using GPT-4o-mini if not already in English
            if (detectedLanguage && detectedLanguage !== 'en' && detectedLanguage !== 'en_us' && detectedLanguage !== 'unknown') {
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
                    content: originalTranscription
                  }
                ],
              })
              translationText = translation.choices[0].message.content
              console.log('Translation to English complete')
            } else {
              console.log('Audio is already in English, skipping translation')
              translationText = originalTranscription
            }
          } catch (assemblyAIError) {
            console.error('AssemblyAI API error, falling back to Whisper:', assemblyAIError.message)
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

/**
 * POST /api/whisper/transcribe-voice
 * Transcribe user voice input and translate to English
 */
router.post('/transcribe-voice', uploadAudio.single('audio'), async (req, res) => {
  let audioPath = null
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' })
    }

    audioPath = req.file.path
    console.log('Processing voice input:', audioPath)

    // Get OpenAI client
    const client = getOpenAIClient()

    // Transcribe with Whisper
    console.log('Transcribing voice with Whisper...')
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
    })

    const detectedLanguage = transcription.language
    const originalText = transcription.text

    console.log('Voice transcription complete. Language:', detectedLanguage)

    // Translate to English if needed
    let translationText = originalText
    if (detectedLanguage !== 'en' && detectedLanguage !== 'english') {
      console.log('Translating voice to English...')
      const translation = await client.audio.translations.create({
        file: fs.createReadStream(audioPath),
        model: 'whisper-1',
      })
      translationText = translation.text
      console.log('Voice translation complete')
    }

    // Clean up file
    fs.unlinkSync(audioPath)

    // Return results
    res.json({
      transcription: originalText,
      translation: translationText,
      language: detectedLanguage,
    })

  } catch (error) {
    console.error('Error in voice transcription:', error)
    
    // Clean up file on error
    if (audioPath && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath)
    }

    res.status(500).json({ 
      error: error.message || 'Failed to transcribe voice',
      details: error.toString()
    })
  }
})

/**
 * POST /api/whisper/final-summary
 * Generate final summary combining video and user perspectives
 */
router.post('/final-summary', async (req, res) => {
  try {
    const { videoSummary, userInput } = req.body

    if (!videoSummary || !userInput) {
      return res.status(400).json({ error: 'Missing videoSummary or userInput' })
    }

    console.log('Generating final combined summary...')

    // Get OpenAI client
    const client = getOpenAIClient()

    // Generate combined summary
    const summary = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating comprehensive summaries that combine multiple perspectives. Your task is to synthesize information from both a video transcription summary and a user\'s personal observations/thoughts about the video. Create a unified, coherent summary that incorporates both viewpoints, highlighting any agreements, contrasts, or complementary insights.'
        },
        {
          role: 'user',
          content: `Please create a comprehensive summary that combines these two perspectives:

VIDEO SUMMARY:
${videoSummary}

USER'S PERSPECTIVE:
${userInput}

Create a final summary that integrates both viewpoints into a cohesive narrative.`
        }
      ],
      max_tokens: 300,
    })

    const finalSummary = summary.choices[0].message.content

    console.log('Final summary generated successfully')

    res.json({
      finalSummary,
    })

  } catch (error) {
    console.error('Error generating final summary:', error)
    res.status(500).json({ 
      error: error.message || 'Failed to generate final summary',
      details: error.toString()
    })
  }
})

export default router
