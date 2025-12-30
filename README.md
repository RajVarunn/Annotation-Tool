# Video Annotation Tool

A React-based web application for annotating video clips with AI-powered audio transcription and OCR text extraction.

## Features

- **Video Upload**: Support for 20-30 second video clips
- **Audio Transcription**: Uses OpenAI's Whisper model to transcribe and translate audio to English with summary
- **OCR Text Extraction**: Extracts text from video frames and translates to English using Tesseract.js
- **Real-time Processing**: Visual feedback during processing
- **Modern UI**: Clean and intuitive interface

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- OpenAI API key
- FFmpeg (for audio extraction)

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_api_key_here
   PORT=5000
   ```

3. **Start the development server:**
   
   In one terminal, start the backend server:
   ```bash
   npm run server
   ```
   
   In another terminal, start the React app:
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Usage

1. Click "Choose Video File" or drag and drop a video file (MP4, WebM, or other supported formats)
2. Preview the uploaded video
3. Click "Transcribe Audio with Whisper" to:
   - Extract audio from the video
   - Transcribe using OpenAI Whisper
   - Get an English translation and summary
4. Click "Extract Text with OCR" to:
   - Extract frames from the video
   - Perform OCR on frames
   - Translate detected text to English

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── VideoUploader.jsx    # Video upload component
│   │   ├── VideoPlayer.jsx      # Video playback component
│   │   └── ResultsDisplay.jsx   # Display transcription/OCR results
│   ├── services/
│   │   └── api.js               # API client for backend
│   ├── App.jsx                  # Main application component
│   ├── App.css                  # Application styles
│   └── main.jsx                 # Entry point
├── server/
│   ├── index.js                 # Express server
│   ├── routes/
│   │   ├── whisper.js          # Whisper API routes
│   │   └── ocr.js              # OCR API routes
│   └── utils/
│       ├── audioExtractor.js   # Audio extraction utility
│       └── frameExtractor.js   # Frame extraction utility
└── package.json
```

## API Endpoints

### POST /api/whisper/transcribe
Transcribe audio from video using OpenAI Whisper.

**Request:** Multipart form data with video file

**Response:**
```json
{
  "transcription": "...",
  "translation": "...",
  "summary": "..."
}
```

### POST /api/ocr/extract
Extract text from video frames using OCR.

**Request:** Multipart form data with video file

**Response:**
```json
{
  "extractedText": ["text1", "text2", ...],
  "translatedText": ["translated1", "translated2", ...]
}
```

## Technologies Used

- **Frontend:**
  - React 18
  - Vite
  - Axios
  - Modern CSS

- **Backend:**
  - Node.js
  - Express
  - OpenAI API (Whisper)
  - Tesseract.js (OCR)
  - FFmpeg (media processing)
  - Multer (file uploads)

## License

MIT
