import { useState, useEffect } from "react"
import { CalendarPlus, X, Mic, Send, Check, Loader2, RefreshCcw, Download } from "lucide-react"
import { useStructuredPrompt } from "@ahnopologetic/use-prompt-api/react"
import { z } from "zod"

import { useSpeechRecognition } from "../hooks/useSpeechRecognition"
import { createEvent, type CalendarEvent } from "../lib/calendar"
import "../style.css"

const eventSchema = z.object({
    title: z.string(),
    start: z.string().describe("ISO 8601 string, e.g. 2024-01-01T12:00:00"),
    end: z.string().describe("ISO 8601 string"),
    location: z.string().optional(),
    description: z.string().optional()
})

export default function CalendarOverlay() {
    const [isOpen, setIsOpen] = useState(false)
    const [textInput, setTextInput] = useState("")
    const [generatedEvent, setGeneratedEvent] = useState<CalendarEvent | null>(null)
    const [status, setStatus] = useState<"idle" | "generating" | "review" | "creating" | "success" | "error">("idle")
    const [errorMessage, setErrorMessage] = useState("")

    // Model download states
    const [capabilityStatus, setCapabilityStatus] = useState<string>("unknown")
    const [downloadProgress, setDownloadProgress] = useState<number>(0)
    const [isDownloading, setIsDownloading] = useState(false)

    const { isListening, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition()

    const { prompt, ready, loading: aiLoading } = useStructuredPrompt({
        schema: eventSchema,
        systemPrompt: `You are a helpful calendar assistant. The current time is ${new Date().toISOString()}.`
    })

    useEffect(() => {
        checkCapabilities()
    }, [])

    // Sync speech transcript to text input
    useEffect(() => {
        if (transcript) {
            setTextInput((prev) => prev ? prev + " " + transcript : transcript)
            resetTranscript()
        }
    }, [transcript, resetTranscript])

    const checkCapabilities = async () => {
        try {
            const availability = await LanguageModel.availability()
            setCapabilityStatus(availability)
        } catch (e) {
            setCapabilityStatus(`Error checking caps: ${e.message}`)
        }
    }

    const handleDownloadModel = async () => {
        setIsDownloading(true)
        try {
            await LanguageModel.create({
                monitor(m) {
                    m.addEventListener("downloadprogress", (e: any) => {
                        console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`)
                        setDownloadProgress(e.loaded / e.total)
                    })
                },
            })
            setCapabilityStatus("readily")
        } catch (e) {
            setErrorMessage(`Download failed: ${e.message}`)
            setStatus("error")
        } finally {
            setIsDownloading(false)
        }
    }

    const toggleOverlay = () => {
        setIsOpen(!isOpen)
        if (!isOpen) {
            setGeneratedEvent(null)
            setStatus("idle")
            checkCapabilities() // Re-check on open
        }
    }

    const handleGenerate = async () => {
        if (!textInput.trim() || !ready) return
        setStatus("generating")
        setErrorMessage("")

        try {
            const result = await prompt(`Create an event plan for: ${textInput}`)

            const event: CalendarEvent = {
                summary: result.title,
                description: result.description,
                location: result.location,
                start: { dateTime: result.start },
                end: { dateTime: result.end }
            }

            setGeneratedEvent(event)
            setStatus("review")
        } catch (e) {
            setStatus("error")
            setErrorMessage(e.message)
        }
    }

    const handleApprove = async () => {
        if (!generatedEvent) return
        setStatus("creating")
        try {
            await createEvent(generatedEvent)
            setStatus("success")
            setTimeout(() => {
                setIsOpen(false)
                setTextInput("")
                setGeneratedEvent(null)
                setStatus("idle")
            }, 2000)
        } catch (e) {
            setStatus("error")
            setErrorMessage(e.message)
        }
    }

    const handleRetry = () => {
        setGeneratedEvent(null)
        setStatus("idle")
    }

    return (
        <div className="plasmo-fixed plasmo-bottom-8 plasmo-right-8 plasmo-z-50 plasmo-font-sans">
            {/* Main Modal */}
            {isOpen && (
                <div className="plasmo-mb-4 plasmo-w-96 plasmo-bg-white/90 plasmo-backdrop-blur-xl plasmo-rounded-2xl plasmo-shadow-2xl plasmo-border plasmo-border-white/50 plasmo-overflow-hidden plasmo-animate-in plasmo-slide-in-from-bottom-10 plasmo-fade-in plasmo-duration-300">

                    {/* Header */}
                    <div className="plasmo-flex plasmo-items-center plasmo-justify-between plasmo-p-4 plasmo-border-b plasmo-border-gray-100">
                        <h2 className="plasmo-font-semibold plasmo-text-gray-800">
                            {status === "review" ? "Review Plan" : "New Event"}
                        </h2>
                        <button onClick={toggleOverlay} className="plasmo-p-1 plasmo-rounded-full hover:plasmo-bg-gray-100 plasmo-text-gray-500 plasmo-transition">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="plasmo-p-4">
                        {/* Capability Check / Download View */}
                        {capabilityStatus !== "readily" && capabilityStatus !== "unknown" ? (
                            <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-text-center plasmo-py-4 plasmo-space-y-3">
                                <Download size={32} className="plasmo-text-blue-600" />
                                <div>
                                    <h3 className="plasmo-font-bold plasmo-text-gray-800">
                                        {capabilityStatus === "no" ? "Model Not Available" : "AI Model Needed"}
                                    </h3>
                                    <p className="plasmo-text-sm plasmo-text-gray-500 plasmo-mt-1">
                                        {capabilityStatus === "no"
                                            ? "The model is not available in your browser, but you can try downloading it anyway."
                                            : "A small AI model (Gemini Nano) needs to be downloaded to your browser."}
                                    </p>
                                </div>

                                {isDownloading ? (
                                    <div className="plasmo-w-full plasmo-max-w-xs plasmo-mt-2">
                                        <div className="plasmo-bg-gray-200 plasmo-rounded-full plasmo-h-2 plasmo-w-full">
                                            <div
                                                className="plasmo-bg-blue-600 plasmo-h-2 plasmo-rounded-full plasmo-transition-all"
                                                style={{ width: `${downloadProgress * 100}%` }}
                                            ></div>
                                        </div>
                                        <p className="plasmo-text-xs plasmo-text-gray-600 plasmo-mt-2">
                                            Downloading... {Math.round(downloadProgress * 100)}%
                                        </p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleDownloadModel}
                                        className="plasmo-px-4 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded-xl plasmo-font-medium hover:plasmo-bg-blue-700 plasmo-transition"
                                    >
                                        Download Model
                                    </button>
                                )}
                            </div>
                        ) : (status === "idle" || status === "generating" || status === "error" ? (
                            <>
                                <div className="plasmo-relative">
                                    <textarea
                                        className="plasmo-w-full plasmo-h-32 plasmo-p-3 plasmo-bg-gray-50 plasmo-rounded-xl plasmo-resize-none focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500/50 plasmo-text-gray-700 plasmo-placeholder-gray-400"
                                        placeholder="Describe your event... e.g. 'Coffee with Ryan tomorrow at 10am'"
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        disabled={status === "generating"}
                                    />

                                    <button
                                        className={`plasmo-absolute plasmo-bottom-3 plasmo-right-3 plasmo-p-2 plasmo-rounded-full plasmo-transition-colors ${isListening ? "plasmo-bg-red-100 plasmo-text-red-600 plasmo-animate-pulse" : "plasmo-bg-white plasmo-text-gray-500 hover:plasmo-bg-gray-200"}`}
                                        onClick={isListening ? stopListening : startListening}
                                        disabled={status === "generating"}
                                    >
                                        <Mic size={18} />
                                    </button>
                                </div>

                                {status === "error" && (
                                    <p className="plasmo-text-red-500 plasmo-text-sm plasmo-mt-2">
                                        {errorMessage || "Something went wrong."}
                                    </p>
                                )}

                                <div className="plasmo-mt-4 plasmo-flex plasmo-justify-end">
                                    <button
                                        onClick={handleGenerate}
                                        disabled={!textInput.trim() || status === "generating" || !ready}
                                        className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-px-4 plasmo-py-2 plasmo-bg-blue-600 hover:plasmo-bg-blue-700 disabled:plasmo-bg-blue-400 plasmo-text-white plasmo-rounded-xl plasmo-font-medium plasmo-shadow-lg plasmo-shadow-blue-600/20 plasmo-transition-all active:plasmo-scale-95"
                                    >
                                        {status === "generating" ? (
                                            <>
                                                <Loader2 size={16} className="plasmo-animate-spin" />
                                                <span>Thinking...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Generate Plan</span>
                                                <Send size={16} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            // Review / Success State
                            <div className="plasmo-space-y-4">
                                {status === "success" ? (
                                    <div className="plasmo-flex plasmo-flex-col plasmo-items-center plasmo-justify-center plasmo-py-8 plasmo-text-green-600">
                                        <div className="plasmo-p-3 plasmo-bg-green-100 plasmo-rounded-full plasmo-mb-3">
                                            <Check size={32} />
                                        </div>
                                        <p className="plasmo-font-semibold">Event Created!</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="plasmo-bg-gray-50 plasmo-p-4 plasmo-rounded-xl plasmo-border plasmo-border-gray-100 plasmo-space-y-2">
                                            <h3 className="plasmo-font-bold plasmo-text-lg">{generatedEvent?.summary}</h3>
                                            <div className="plasmo-text-sm plasmo-text-gray-600">
                                                <p>📅 {generatedEvent?.start.dateTime ? new Date(generatedEvent.start.dateTime).toLocaleString() : ""}</p>
                                                {generatedEvent?.location && <p>📍 {generatedEvent.location}</p>}
                                                {generatedEvent?.description && <p>📝 {generatedEvent.description}</p>}
                                            </div>
                                        </div>

                                        <div className="plasmo-flex plasmo-justify-between plasmo-gap-2">
                                            <button
                                                onClick={handleRetry}
                                                className="plasmo-flex-1 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-gap-2 plasmo-px-4 plasmo-py-2 plasmo-bg-gray-100 hover:plasmo-bg-gray-200 plasmo-text-gray-700 plasmo-rounded-xl plasmo-font-medium plasmo-transition-colors"
                                            >
                                                <RefreshCcw size={16} />
                                                <span>Retry</span>
                                            </button>
                                            <button
                                                onClick={handleApprove}
                                                className="plasmo-flex-1 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-gap-2 plasmo-px-4 plasmo-py-2 plasmo-bg-green-600 hover:plasmo-bg-green-700 plasmo-text-white plasmo-rounded-xl plasmo-font-medium plasmo-shadow-lg plasmo-shadow-green-600/20 plasmo-transition-all active:plasmo-scale-95"
                                            >
                                                {status === "creating" ? <Loader2 size={16} className="plasmo-animate-spin" /> : <Check size={16} />}
                                                <span>Approve</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            {!isOpen && (
                <button
                    onClick={toggleOverlay}
                    className="plasmo-p-4 plasmo-bg-gradient-to-br plasmo-from-blue-600 plasmo-to-blue-700 plasmo-text-white plasmo-rounded-2xl plasmo-shadow-2xl hover:plasmo-shadow-blue-600/30 plasmo-transition-all hover:plasmo-scale-105 active:plasmo-scale-95"
                >
                    <CalendarPlus size={24} />
                </button>
            )}
        </div>
    )
}
