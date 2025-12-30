import { useRef, useEffect } from 'react'
import './VideoPlayer.css'

function VideoPlayer({ videoUrl }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load()
    }
  }, [videoUrl])

  return (
    <div className="video-player">
      <video
        ref={videoRef}
        controls
        className="video-element"
      >
        <source src={videoUrl} />
        Your browser does not support the video tag.
      </video>
    </div>
  )
}

export default VideoPlayer
