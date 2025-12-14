import { useState, useRef, useEffect } from 'react'
import { showToast } from '../lib/toast'

interface MediaRecorderProps {
  onRecordingComplete: (file: File, type: 'audio' | 'video') => void
  onRecordingCancel?: () => void
  maxDuration?: number // in seconds
  allowedTypes?: ('audio' | 'video')[]
}

export default function MediaRecorder({ 
  onRecordingComplete, 
  onRecordingCancel,
  maxDuration = 300, // 5 minutes default
  allowedTypes = ['audio', 'video']
}: MediaRecorderProps) {
  const [recordingType, setRecordingType] = useState<'audio' | 'video'>('audio')
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const mediaRecorderRef = useRef<globalThis.MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }

  async function startRecording() {
    try {
      setError(null)
      chunksRef.current = []
      
      const constraints: MediaStreamConstraints = recordingType === 'video'
        ? { video: true, audio: true }
        : { audio: true }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)

      // Set up preview
      if (recordingType === 'video' && videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
      } else if (recordingType === 'audio' && audioRef.current) {
        // For audio, we can create a visualizer or just show controls
        const audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(mediaStream)
        // Audio preview is handled by the audio element if needed
      }

      // Set up MediaRecorder
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'audio/webm',
        'audio/mp4',
        'audio/mpeg'
      ]
      
      let selectedMimeType = ''
      for (const mimeType of mimeTypes) {
        if (globalThis.MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          break
        }
      }

      const recorder = new globalThis.MediaRecorder(mediaStream, {
        mimeType: selectedMimeType || undefined
      })

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { 
          type: selectedMimeType || (recordingType === 'video' ? 'video/webm' : 'audio/webm')
        })
        setRecordingBlob(blob)
        stopStream()
      }

      recorder.onerror = (e: Event) => {
        setError('Recording error occurred')
        showToast('Recording error', 'error')
      }

      mediaRecorderRef.current = recorder
      recorder.start(1000) // Collect data every second
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1
          if (newTime >= maxDuration) {
            stopRecording()
            showToast(`Recording stopped at maximum duration (${maxDuration}s)`, 'info')
          }
          return newTime
        })
      }, 1000)

    } catch (err: any) {
      setError(err?.message || 'Failed to start recording')
      showToast('Failed to access camera/microphone. Please check permissions.', 'error')
      stopStream()
    }
  }

  function pauseRecording() {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  function resumeRecording() {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1
          if (newTime >= maxDuration) {
            stopRecording()
            showToast(`Recording stopped at maximum duration (${maxDuration}s)`, 'info')
          }
          return newTime
        })
      }, 1000)
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      stopStream()
    }
  }

  function cancelRecording() {
    if (isRecording) {
      stopRecording()
    }
    setRecordingBlob(null)
    setRecordingTime(0)
    setError(null)
    if (onRecordingCancel) {
      onRecordingCancel()
    }
  }

  function saveRecording() {
    if (recordingBlob) {
      const fileExtension = recordingType === 'video' 
        ? (recordingBlob.type.includes('webm') ? 'webm' : 'mp4')
        : (recordingBlob.type.includes('webm') ? 'webm' : 'mp3')
      
      const fileName = `${recordingType}_recording_${Date.now()}.${fileExtension}`
      const file = new File([recordingBlob], fileName, { type: recordingBlob.type })
      onRecordingComplete(file, recordingType)
      setRecordingBlob(null)
      setRecordingTime(0)
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-800">Record Evidence</h4>
        {allowedTypes.length > 1 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!isRecording) {
                  setRecordingType('audio')
                  setError(null)
                }
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                recordingType === 'audio'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              disabled={isRecording}
            >
              Audio
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isRecording) {
                  setRecordingType('video')
                  setError(null)
                }
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                recordingType === 'video'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              disabled={isRecording}
            >
              Video
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Video Preview */}
      {recordingType === 'video' && (
        <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '200px' }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full ${isRecording ? 'block' : 'hidden'}`}
            style={{ maxHeight: '300px', objectFit: 'contain' }}
          />
          {!isRecording && !recordingBlob && (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p>Camera preview will appear here</p>
              </div>
            </div>
          )}
          {recordingBlob && !isRecording && (
            <video
              src={URL.createObjectURL(recordingBlob)}
              controls
              className="w-full"
              style={{ maxHeight: '300px', objectFit: 'contain' }}
            />
          )}
        </div>
      )}

      {/* Audio Preview/Visualizer */}
      {recordingType === 'audio' && (
        <div className="bg-gray-50 rounded-lg p-4">
          {isRecording && (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex gap-1 h-12 items-end">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-blue-500 rounded-t"
                      style={{
                        height: `${Math.random() * 60 + 20}%`,
                        animation: 'pulse 0.5s ease-in-out infinite',
                        animationDelay: `${i * 0.05}s`
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="text-2xl font-bold text-red-600">●</div>
            </div>
          )}
          {recordingBlob && !isRecording && (
            <audio
              ref={audioRef}
              src={URL.createObjectURL(recordingBlob)}
              controls
              className="w-full"
            />
          )}
          {!isRecording && !recordingBlob && (
            <div className="text-center text-gray-500 py-4">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p>Microphone ready</p>
            </div>
          )}
        </div>
      )}

      {/* Recording Timer */}
      {(isRecording || recordingBlob) && (
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-800">
            {formatTime(recordingTime)}
          </div>
          {maxDuration && (
            <div className="text-sm text-gray-500">
              Max: {formatTime(maxDuration)}
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {!isRecording && !recordingBlob && (
          <button
            type="button"
            onClick={startRecording}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Start Recording
          </button>
        )}

        {isRecording && (
          <>
            {!isPaused ? (
              <button
                type="button"
                onClick={pauseRecording}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors font-medium"
              >
                Pause
              </button>
            ) : (
              <button
                type="button"
                onClick={resumeRecording}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
              >
                Resume
              </button>
            )}
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
            >
              Stop
            </button>
          </>
        )}

        {recordingBlob && !isRecording && (
          <>
            <button
              type="button"
              onClick={saveRecording}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Use Recording
            </button>
            <button
              type="button"
              onClick={cancelRecording}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center">
        {recordingType === 'video' 
          ? 'Recording will include both video and audio'
          : 'Recording audio only'}
      </p>
    </div>
  )
}

