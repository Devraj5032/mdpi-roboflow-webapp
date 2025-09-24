"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, Upload, Loader2, AlertCircle, Video, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Detection {
  class: string
  confidence: number
  x: number
  y: number
  width: number
  height: number
}

interface RoboflowResponse {
  predictions: Detection[]
  image: {
    width: number
    height: number
  }
}

type ModelResult = RoboflowResponse | { error: true; message: string }

interface CameraDevice {
  deviceId: string
  label: string
  kind: string
}

export default function WasteDetectionApp() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<Record<string, ModelResult> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string>("")
  const [isLoadingCameras, setIsLoadingCameras] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const getCameras = useCallback(async () => {
    try {
      setIsLoadingCameras(true)
      setError(null)

      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      // Stop the permission stream immediately
      permissionStream.getTracks().forEach((track) => track.stop())

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices
        .filter((device) => device.kind === "videoinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
          kind: device.kind,
        }))

      setCameras(videoDevices)

      const backCamera = videoDevices.find(
        (camera) =>
          camera.label.toLowerCase().includes("back") ||
          camera.label.toLowerCase().includes("rear") ||
          camera.label.toLowerCase().includes("environment") ||
          camera.label.toLowerCase().includes("0"), // Often the back camera on mobile
      )
      setSelectedCamera(backCamera?.deviceId || videoDevices[0]?.deviceId || "")
    } catch (err) {
      console.error("[v0] Camera access error:", err)
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError(
            "Camera access denied. Please allow camera permissions in your browser settings and refresh the page.",
          )
        } else if (err.name === "NotFoundError") {
          setError("No cameras found on this device.")
        } else if (err.name === "NotSupportedError") {
          setError("Camera access is not supported on this device or browser.")
        } else {
          setError(
            "Failed to access cameras. Please ensure camera permissions are granted and try refreshing the page.",
          )
        }
      } else {
        setError("Failed to access cameras. Please ensure camera permissions are granted.")
      }
    } finally {
      setIsLoadingCameras(false)
    }
  }, [])

  useEffect(() => {
    getCameras()
  }, [getCameras])

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      console.log("[v0] Starting camera...")

      // Stop any existing stream before starting a new one
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      const constraints = {
        video: selectedCamera
          ? {
              deviceId: { exact: selectedCamera },
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              facingMode: selectedCamera ? undefined : "environment",
            }
          : {
              facingMode: "environment",
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
            },
      }

      console.log("[v0] Starting camera with constraints:", constraints)
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      console.log("[v0] Got media stream:", stream)

      // Mount the video element first; an effect will attach and play the stream
      setIsCapturing(true)
    } catch (err) {
      console.error("[v0] Camera start error:", err)
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("Camera access denied. Please allow camera permissions and try again.")
        } else if (err.name === "NotFoundError") {
          setError("Selected camera not found. Please try a different camera.")
        } else if (err.name === "OverconstrainedError") {
          setError("Camera constraints not supported. Trying with basic settings...")
          try {
            const basicStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "environment" },
            })
            streamRef.current = basicStream
            if (videoRef.current) {
              videoRef.current.srcObject = basicStream
              setIsCapturing(true)
              videoRef.current.onloadedmetadata = async () => {
                try {
                  if (videoRef.current) {
                    await videoRef.current.play()
                  }
                } catch (playError) {
                  setError("Failed to start video preview with basic settings.")
                }
              }
            }
            setError(null)
          } catch (fallbackErr) {
            setError("Failed to access camera with basic settings.")
          }
        } else {
          setError("Failed to access camera. Please try again.")
        }
      } else {
        setError("Failed to access camera. Please ensure camera permissions are granted.")
      }
    }
  }, [selectedCamera])

  // When the video element exists and we are capturing, attach the stream and play
  useEffect(() => {
    const attachAndPlay = async () => {
      if (!isCapturing || !videoRef.current || !streamRef.current) return

      try {
        const video = videoRef.current
        video.srcObject = streamRef.current
        video.setAttribute("playsinline", "true")
        video.muted = true
        video.autoplay = true

        video.oncanplay = () => {
          console.log("[v0] Video can play")
        }
        video.onerror = (e) => {
          console.error("[v0] Video error:", e)
          setError("Video preview error. Please try again.")
        }

        if (video.readyState >= 1) {
          await video.play()
          console.log("[v0] Video playing immediately (effect)")
        } else {
          await new Promise<void>((resolve) => {
            video.onloadedmetadata = async () => {
              console.log("[v0] Video metadata loaded (effect)")
              try {
                await video.play()
                console.log("[v0] Video playing successfully (effect)")
              } catch (playError) {
                console.error("[v0] Video play error (effect):", playError)
                setError("Failed to start video preview. Please try again.")
              }
              resolve()
            }
          })
        }
      } catch (e) {
        console.error("[v0] Error attaching/playing stream:", e)
      }
    }
    attachAndPlay()
  }, [isCapturing])

  // Auto-restart the camera preview when switching cameras while capturing
  useEffect(() => {
    const restartOnSwitch = async () => {
      if (isCapturing) {
        try {
          await startCamera()
        } catch (e) {
          // Error is already handled inside startCamera
        }
      }
    }
    restartOnSwitch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamera])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
    setIsCapturing(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  const captureImage = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const video = videoRef.current
      const context = canvas.getContext("2d")

      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0)

        const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8)
        setCapturedImage(imageDataUrl)
        stopCamera()
      }
    }
  }, [stopCamera])

  const analyzeImage = useCallback(async () => {
    if (!capturedImage) return

    setIsAnalyzing(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: capturedImage }),
      })

      if (!response.ok) {
        throw new Error("Failed to analyze image")
      }

      const data = await response.json()
      // API returns: { models: { [id]: result | {error} } }
      setResults(data.models)
    } catch (err) {
      setError("Failed to analyze image. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }, [capturedImage])

  const reset = useCallback(() => {
    setCapturedImage(null)
    setResults(null)
    setError(null)
    stopCamera()
  }, [stopCamera])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* <div className="text-center space-y-3 py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mb-4">
            <Camera className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Waste Detection AI
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Capture images using your camera to detect and classify waste items with advanced AI technology
          </p>
        </div> */}

        {error && (
          <Alert variant="destructive" className="border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Video className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Camera Capture</CardTitle>
                <CardDescription>Select your camera and capture images for AI analysis</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {cameras.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Select Camera</label>
                <div className="flex gap-3 items-center">
                  <Select value={selectedCamera} onValueChange={setSelectedCamera} disabled={isCapturing}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Choose a camera..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cameras.map((camera) => (
                        <SelectItem key={camera.deviceId} value={camera.deviceId}>
                          <div className="flex items-center gap-2">
                            <Camera className="h-4 w-4" />
                            {camera.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={getCameras}
                    disabled={isLoadingCameras || isCapturing}
                    title="Refresh cameras"
                  >
                    <RotateCcw className={`h-4 w-4 ${isLoadingCameras ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            )}

            {!isCapturing && !capturedImage && (
              <div className="text-center space-y-6">
                <div className="w-full h-80 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 rounded-xl flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto">
                      <Camera className="h-10 w-10 text-slate-400" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">Ready to capture</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                      Make sure to allow camera permissions when prompted
                    </p>
                  </div>
                </div>
                <Button
                  onClick={startCamera}
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-lg"
                  disabled={!selectedCamera && cameras.length > 0}
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Start Camera
                </Button>
              </div>
            )}

            {isCapturing && (
              <div className="space-y-6">
                <div className="relative overflow-hidden rounded-xl">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl shadow-lg" />
                  <div className="absolute inset-0 border-4 border-emerald-400/50 rounded-xl pointer-events-none"></div>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={captureImage}
                    size="lg"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3"
                  >
                    <Camera className="mr-2 h-5 w-5" />
                    Capture Image
                  </Button>
                  <Button onClick={stopCamera} variant="outline" size="lg" className="px-6 bg-transparent">
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="space-y-6">
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={capturedImage || "/placeholder.svg"}
                    alt="Captured"
                    className="w-full rounded-xl shadow-lg"
                  />
                  {(() => {
                    if (!results) return null
                    // pick first successful model result for overlay
                    const firstOk = Object.values(results).find(
                      (r) => !("error" in (r as any)) && (r as RoboflowResponse).predictions?.length > 0,
                    ) as RoboflowResponse | undefined
                    if (!firstOk) return null
                    return (
                    <svg
                      className="absolute inset-0 w-full h-full"
                      viewBox={`0 0 ${firstOk.image.width} ${firstOk.image.height}`}
                    >
                      {firstOk.predictions.map((detection, index) => (
                        <g key={index}>
                          <rect
                            x={detection.x - detection.width / 2}
                            y={detection.y - detection.height / 2}
                            width={detection.width}
                            height={detection.height}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3"
                            rx="4"
                          />
                          <rect
                            x={detection.x - detection.width / 2}
                            y={detection.y - detection.height / 2 - 30}
                            width={detection.width}
                            height="25"
                            fill="#10b981"
                            fillOpacity="0.9"
                            rx="4"
                          />
                          <text
                            x={detection.x - detection.width / 2 + 8}
                            y={detection.y - detection.height / 2 - 10}
                            fill="white"
                            fontSize="14"
                            fontWeight="600"
                          >
                            {detection.class} ({Math.round(detection.confidence * 100)}%)
                          </text>
                        </g>
                      ))}
                    </svg>
                    )
                  })()}
                </div>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                    size="lg"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-5 w-5" />
                    )}
                    {isAnalyzing ? "Analyzing..." : "Analyze Image"}
                  </Button>
                  <Button onClick={reset} variant="outline" size="lg" className="px-6 bg-transparent">
                    Take New Photo
                  </Button>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />
          </CardContent>
        </Card>

        {results && (
          <Card className="border-0 shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-xl">Detection Results</CardTitle>
                  <CardDescription>AI-powered waste detection analysis results</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const allPreds: Detection[] = []
                if (results) {
                  Object.values(results).forEach((res) => {
                    if (!("error" in (res as any))) {
                      const rf = res as RoboflowResponse
                      if (rf.predictions && rf.predictions.length > 0) {
                        allPreds.push(...rf.predictions)
                      }
                    }
                  })
                }

                if (allPreds.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-lg">No waste items detected in this image.</p>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Try capturing a different angle or better lighting.</p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {allPreds.length} item{allPreds.length !== 1 ? "s" : ""} detected
                      </Badge>
                    </div>
                    <div className="grid gap-4">
                      {allPreds.map((detection, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-600">
                          <div className="space-y-2">
                            <p className="font-semibold text-lg capitalize">{detection.class}</p>
                            <p className="text-sm text-muted-foreground">Position: ({Math.round(detection.x)}, {Math.round(detection.y)}) • Size: {Math.round(detection.width)}×{Math.round(detection.height)}px</p>
                          </div>
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 text-base px-3 py-1">
                            {Math.round(detection.confidence * 100)}% confident
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}
      </div> 
    </div>
  )
}
