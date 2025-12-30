import dotenv from 'dotenv'
// Load environment variables FIRST before any other imports
dotenv.config()

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import whisperRouter from './routes/whisper.js'
import ocrRouter from './routes/ocr.js'

// ES module dirname fix
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads')
const tempDir = path.join(__dirname, '../temp')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true })
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' })
})

app.use('/api/whisper', whisperRouter)
app.use('/api/ocr', ocrRouter)

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err)
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' })
    }
    return res.status(400).json({ error: err.message })
  }
  
  res.status(500).json({ 
    error: err.message || 'Internal server error' 
  })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`)
  console.log(`📝 API endpoints:`)
  console.log(`   - POST http://localhost:${PORT}/api/whisper/transcribe`)
  console.log(`   - POST http://localhost:${PORT}/api/ocr/extract`)
})
