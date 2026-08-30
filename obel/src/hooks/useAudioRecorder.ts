import { useState, useRef, useEffect } from 'react'

interface UseAudioRecorderProps {
  onAudioRecorded: (audioId: string, base64Audio: string) => void
}

export function useAudioRecorder({ onAudioRecorded }: UseAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mediaRecorderRef = useRef<any>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      })
      
      mediaRecorderRef.current = mediaRecorder
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        
        // Stop all tracks on the stream to release the mic!
        stream.getTracks().forEach((track) => track.stop())
        
        // Convert audioBlob to Base64
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64Audio = reader.result as string
          const audioId = Math.random().toString(36).substring(2, 7)
          onAudioRecorded(audioId, base64Audio)
        }
        reader.readAsDataURL(audioBlob)
      }
      
      mediaRecorder.start(250) // slice of data every 250ms
      setIsRecording(true)
      setRecordingDuration(0)
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)
      
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([15, 10, 15])
      }
    } catch (err) {
      console.error('Error starting media recording:', err)
      alert('Could not access microphone. Please check system permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.stop()
      
      const stream = mediaRecorderRef.current.stream
      stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      
      setIsRecording(false)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
      setRecordingDuration(0)
    }
  }

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
        mediaRecorderRef.current.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      }
    }
  }, [])

  return {
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording
  }
}
