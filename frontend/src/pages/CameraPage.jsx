import { useState, useRef } from 'react'
import { useTripStore } from '../store/tripStore'
import BackHeader from '../components/BackHeader'

export default function CameraPage({ onBack, onBillExtracted }) {
  const { dispatch } = useTripStore()
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState('')

  const cameraRef = useRef()
  const libraryRef = useRef()

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  function retake() {
    setPreview(null)
    setFile(null)
    setError('')
    if (cameraRef.current) cameraRef.current.value = ''
    if (libraryRef.current) libraryRef.current.value = ''
  }

  async function usePhoto() {
    if (!file) return
    setExtracting(true)
    setError('')
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/extract-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: base64, image_type: file.type }),
      })
      if (!res.ok) throw new Error('Extraction failed')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      dispatch({ type: 'UPDATE_FLOW', payload: { bill: data } })
      onBillExtracted()
    } catch (err) {
      setError(err.message || 'Could not read receipt — check the image and try again')
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-svh" style={{ background: '#0a0a0a' }}>
      <BackHeader title="Add receipt" onBack={onBack} />

      {/* Viewfinder / Preview */}
      <div className="flex-1 flex items-center justify-center p-6">
        {!preview ? (
          <div
            className="w-full max-w-xs rounded-3xl flex flex-col items-center justify-center gap-4 py-16 px-8"
            style={{
              border: '2px dashed rgba(255,255,255,0.15)',
              background: '#1c1c1e',
            }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <p className="text-center text-sm" style={{ color: '#8e8e93' }}>
              Take a photo of the receipt or choose from your library
            </p>
          </div>
        ) : (
          <div className="w-full max-w-xs">
            <img
              src={preview}
              alt="Receipt preview"
              className="w-full rounded-2xl object-cover"
              style={{ maxHeight: '65vh' }}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 pb-3">
          <p className="text-sm text-center px-4 py-2.5 rounded-xl"
            style={{ background: '#ff453a22', color: '#ff453a' }}>
            {error}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="p-4 flex flex-col gap-3" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {!preview ? (
          <>
            {/* Hidden file inputs */}
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
            <input
              ref={libraryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full py-4 rounded-2xl font-bold text-base"
              style={{ background: '#00d669', color: '#000' }}
            >
              Take photo
            </button>
            <button
              onClick={() => libraryRef.current?.click()}
              className="w-full py-3.5 rounded-2xl font-medium text-sm"
              style={{
                background: '#1c1c1e',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Choose from library
            </button>
          </>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={retake}
              disabled={extracting}
              className="flex-1 py-4 rounded-2xl font-medium text-sm"
              style={{
                background: '#1c1c1e',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              Retake
            </button>
            <button
              onClick={usePhoto}
              disabled={extracting}
              className="flex-2 py-4 rounded-2xl font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: '#00d669', color: '#000', flex: 2 }}
            >
              {extracting ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeLinecap="round" opacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Scanning...
                </>
              ) : 'Use this photo →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
