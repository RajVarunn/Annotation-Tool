import './ResultsDisplay.css'

function ResultsDisplay({ transcriptionResult, ocrResult }) {
  if (!transcriptionResult && !ocrResult) {
    return null
  }

  return (
    <div className="results-display">
      {transcriptionResult && (
        <div className="result-section transcription-section">
          <h2>🎙️ Audio Transcription Results</h2>
          
          {transcriptionResult.model && (
            <div className="model-badge">
              <span>Model: <strong>{transcriptionResult.model === 'whisper' ? 'OpenAI Whisper' : transcriptionResult.model === 'elevenlabs' ? 'ElevenLabs Scribe V1' : transcriptionResult.model === 'assemblyai' ? 'AssemblyAI' : transcriptionResult.model}</strong></span>
            </div>
          )}
          
          {transcriptionResult.transcription && (
            <div className="result-box">
              <h3>Original Transcription:</h3>
              <p>{transcriptionResult.transcription}</p>
            </div>
          )}

          {transcriptionResult.translation && (
            <div className="result-box">
              <h3>English Translation:</h3>
              <p>{transcriptionResult.translation}</p>
            </div>
          )}

          {transcriptionResult.summary && (
            <div className="result-box highlight">
              <h3>Summary:</h3>
              <p>{transcriptionResult.summary}</p>
            </div>
          )}
        </div>
      )}

      {ocrResult && (
        <div className="result-section ocr-section">
          <h2>📝 OCR Text Extraction Results (GPT-4 Vision)</h2>
          
          <div className="result-box">
            <h3>📊 Summary:</h3>
            <p><strong>Total Frames:</strong> {ocrResult.totalFrames}</p>
            <p><strong>Frames with Text:</strong> {ocrResult.framesWithText}</p>
          </div>

          {ocrResult.results && ocrResult.results.length > 0 && (
            <div className="result-box">
              <h3>Extracted & Translated Text:</h3>
              <div className="text-list">
                {ocrResult.results.map((result, index) => (
                  <div key={index} className="text-item">
                    <div className="frame-header">
                      <span className="text-number">Frame {index + 1}</span>
                      {result.detectedLanguage && result.detectedLanguage !== 'none' && (
                        <span className="language-badge">
                          🌍 {result.detectedLanguage}
                        </span>
                      )}
                      {result.confidence && (
                        <span className={`confidence-badge confidence-${result.confidence}`}>
                          {result.confidence === 'high' ? '✅' : result.confidence === 'medium' ? '⚠️' : '❌'} {result.confidence}
                        </span>
                      )}
                    </div>
                    
                    {result.hasText ? (
                      <>
                        {result.originalText && result.detectedLanguage !== 'English' && result.detectedLanguage !== 'none' && (
                          <div className="text-content-section">
                            <strong>Original:</strong> {result.originalText}
                          </div>
                        )}
                        <div className="text-content-section highlight-text">
                          <strong>English:</strong> {result.translatedText || result.originalText}
                        </div>
                      </>
                    ) : (
                      <span className="text-content no-text">(No text detected)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ocrResult.framesWithText === 0 && (
            <div className="result-box">
              <p className="no-results">No text was detected in any of the video frames.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ResultsDisplay
