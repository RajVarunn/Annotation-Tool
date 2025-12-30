import express from 'express'
import { upload } from '../config/multer.js'
import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extractFrames } from '../utils/frameExtractor.js'

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
 * Helper function to encode image to base64
 */
const encodeImageToBase64 = (imagePath) => {
  const imageBuffer = fs.readFileSync(imagePath)
  return imageBuffer.toString('base64')
}

/**
 * POST /api/ocr/extract
 * Extract text from video frames using GPT-4 Vision
 */
router.post('/extract', upload.single('video'), async (req, res) => {
  let framePaths = []
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' })
    }

    const videoPath = req.file.path
    console.log('Processing video for OCR with GPT-4 Vision:', videoPath)

    // Extract frames from video
    console.log('Extracting frames...')
    framePaths = await extractFrames(videoPath, 5) // Extract 5 frames
    console.log(`Extracted ${framePaths.length} frames`)

    // Get OpenAI client
    const client = getOpenAIClient()

    // Process frames in parallel with GPT-4 Vision
    console.log('Processing frames with GPT-4 Vision...')
    const ocrPromises = framePaths.map(async (framePath, index) => {
      console.log(`Processing frame ${index + 1}/${framePaths.length}`)
      
      try {
        // Encode image to base64
        const base64Image = encodeImageToBase64(framePath)
        
        // Call GPT-4 Vision API
        const response = await client.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract all visible text from this image. If any text is not in English, translate it to English. 
                  
Return your response in the following JSON format:
{
  "hasText": true/false,
  "originalText": "the exact text as it appears in the image",
  "translatedText": "English translation if needed, or same as original if already in English",
  "detectedLanguage": "language name or 'English'",
  "confidence": "high/medium/low"
}

If there is no text in the image, return:
{
  "hasText": false,
  "originalText": "",
  "translatedText": "",
  "detectedLanguage": "none",
  "confidence": "high"
}`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 500,
        })

        const result = response.choices[0].message.content
        
        // Try to parse JSON response
        try {
          const jsonMatch = result.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            console.log(`Frame ${index + 1}: ${parsed.hasText ? 'Text found' : 'No text'}`)
            return parsed
          }
        } catch (parseError) {
          console.error(`Error parsing JSON from frame ${index + 1}:`, parseError)
        }
        
        // Fallback if JSON parsing fails
        return {
          hasText: result.length > 50,
          originalText: result,
          translatedText: result,
          detectedLanguage: 'unknown',
          confidence: 'medium'
        }
        
      } catch (ocrError) {
        console.error(`Error processing frame ${index + 1}:`, ocrError)
        return {
          hasText: false,
          originalText: '',
          translatedText: '',
          detectedLanguage: 'error',
          confidence: 'low',
          error: ocrError.message
        }
      }
    })

    // Wait for all frames to be processed
    const results = await Promise.all(ocrPromises)

    // Extract data from results
    const extractedTexts = results.map(r => r.originalText || '')
    const translatedTexts = results.map(r => r.translatedText || '')
    const languages = results.map(r => r.detectedLanguage || 'unknown')
    const confidences = results.map(r => r.confidence || 'low')
    
    // Filter results with actual text
    const framesWithText = results.filter(r => r.hasText).length

    // Clean up files
    fs.unlinkSync(videoPath)
    framePaths.forEach(framePath => {
      if (fs.existsSync(framePath)) {
        fs.unlinkSync(framePath)
      }
    })

    console.log(`OCR complete: ${framesWithText}/${framePaths.length} frames had text`)

    // Return results
    res.json({
      extractedText: extractedTexts,
      translatedText: translatedTexts,
      detectedLanguages: languages,
      confidenceScores: confidences,
      totalFrames: framePaths.length,
      framesWithText: framesWithText,
      results: results, // Full results with metadata
    })

  } catch (error) {
    console.error('Error in OCR extraction:', error)
    
    // Clean up files on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    framePaths.forEach(framePath => {
      if (fs.existsSync(framePath)) {
        fs.unlinkSync(framePath)
      }
    })

    res.status(500).json({ 
      error: error.message || 'Failed to extract text from video',
      details: error.toString()
    })
  }
})

export default router