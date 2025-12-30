import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Extract audio from video file with optimized settings for Whisper
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<string>} - Path to the extracted audio file
 */
export const extractAudio = (videoPath) => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      path.dirname(videoPath),
      `audio-${Date.now()}.mp3`
    )

    ffmpeg(videoPath)
      .output(outputPath)
      .audioCodec('libmp3lame')
      .audioBitrate('192k')        // Higher bitrate for better quality (was 128k)
      .audioFrequency(16000)       // 16kHz - Whisper's preferred sample rate
      .audioChannels(1)            // Mono - Whisper works better with single channel
      .audioFilters([
        'highpass=f=200',          // Remove low-frequency rumble
        'lowpass=f=3000',          // Remove high-frequency noise above speech range
        'volume=1.5'               // Normalize volume slightly
      ])
      .noVideo()
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine)
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`Audio extraction progress: ${Math.round(progress.percent)}%`)
        }
      })
      .on('end', () => {
        console.log('Audio extraction completed with optimized settings for Whisper')
        resolve(outputPath)
      })
      .on('error', (err) => {
        console.error('Error extracting audio:', err)
        reject(new Error(`Failed to extract audio: ${err.message}`))
      })
      .run()
  })
}
