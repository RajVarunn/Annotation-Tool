import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Extract frames from video file
 * @param {string} videoPath - Path to the video file
 * @param {number} numFrames - Number of frames to extract (default: 5)
 * @returns {Promise<string[]>} - Array of paths to extracted frame images
 */
export const extractFrames = (videoPath, numFrames = 5) => {
  return new Promise((resolve, reject) => {
    const tempDir = path.join(path.dirname(videoPath), `frames-${Date.now()}`)
    
    // Create temp directory for frames
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const outputPattern = path.join(tempDir, 'frame-%03d.jpg')

    // First, get video duration
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to probe video: ${err.message}`))
        return
      }

      const duration = metadata.format.duration
      const interval = duration / (numFrames + 1)

      // Extract frames at regular intervals
      ffmpeg(videoPath)
        .outputOptions([
          `-vf fps=1/${interval}`,
          '-frames:v', numFrames.toString()
        ])
        .output(outputPattern)
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine)
        })
        .on('progress', (progress) => {
          if (progress.frames) {
            console.log(`Frame extraction progress: ${progress.frames}/${numFrames}`)
          }
        })
        .on('end', () => {
          console.log('Frame extraction completed')
          
          // Get all extracted frame paths
          const files = fs.readdirSync(tempDir)
          const framePaths = files
            .filter(file => file.startsWith('frame-') && file.endsWith('.jpg'))
            .map(file => path.join(tempDir, file))
            .sort()

          resolve(framePaths)
        })
        .on('error', (err) => {
          console.error('Error extracting frames:', err)
          // Clean up temp directory on error
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true })
          }
          reject(new Error(`Failed to extract frames: ${err.message}`))
        })
        .run()
    })
  })
}
