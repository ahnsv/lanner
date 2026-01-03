import { useState, useEffect } from "react"
import { CalendarPlus, X, Mic, Send, Check, Loader2, RefreshCcw, Download } from "lucide-react"
import { usePromptAPI } from "@ahnopologetic/use-prompt-api/react"

import { useSpeechRecognition } from "../hooks/useSpeechRecognition"
import { createEvent, type CalendarEvent } from "../lib/calendar"
import "../style.css"

// Move schema to a constant string for the prompt
const SCHEMA_DEF = `
{
  "events": [
    {
      "title": "string",
      "start": "ISO 8601 string (e.g., 2024-01-01T10:00:00)",
      "end": "ISO 8601 string",
      "location": "string (optional)",
      "description": "string (optional)"
    }
  ]
}
`

export default function CalendarOverlay() {
    const [isOpen, setIsOpen] = useState(false)
    const [textInput, setTextInput] = useState("")
    // Changed to array
    const [generatedEvents, setGeneratedEvents] = useState<CalendarEvent[]>([])

    // Status can include specific count if needed, but for now simple
    const [status, setStatus] = useState<"idle" | "generating" | "review" | "creating" | "success" | "error">("idle")
    const [errorMessage, setErrorMessage] = useState("")

    // Model download states
    const [capabilityStatus, setCapabilityStatus] = useState<string>("unknown")
    const [downloadProgress, setDownloadProgress] = useState<number>(0)
    const [isDownloading, setIsDownloading] = useState(false)

    const { isListening, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition()

    // SWITCH TO BASIC HOOK
    const { prompt, ready } = usePromptAPI({
        systemPrompt: `You are a helpful calendar assistant. 
        The current time and timezone is ${new Date().toTimeString()}.
        The current date is ${new Date().toDateString()}.
        
        INSTRUCTIONS:
        1. Extract ONE OR MORE event details from the user's request.
        2. Respond ONLY with valid JSON matching this structure:
        ${SCHEMA_DEF}
        3. Rules:
           - 'start' and 'end' MUST be valid ISO 8601 strings.
           - If no end time, assume 1 hour.
           - If no date, assume tomorrow.
           - Infer relative dates from today.
           - Do not add any markdown formatting (no \`\`\`json). Just the raw JSON string.
        `
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
            setCapabilityStatus("unknown")
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
            setGeneratedEvents([])
            setStatus("idle")
            checkCapabilities() // Re-check on open
        }
    }

    const handleGenerate = async () => {
        if (!textInput.trim() || !ready) return
        setStatus("generating")
        setErrorMessage("")

        try {
            const rawResult = await prompt(`User Request: ${textInput}`)
            console.log("Raw Model Output:", rawResult)

            // clean up markdown if present
            const cleanJson = rawResult.replace(/```json\n?|\n?```/g, "").trim()
            const result = JSON.parse(cleanJson) // Expected { events: [...] }

            // Validate basic structure
            if (!result.events || !Array.isArray(result.events)) {
                throw new Error("Invalid output format: expected 'events' array")
            }

            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

            const events: CalendarEvent[] = result.events.map((evt: any) => {
                if (!evt.title || !evt.start || !evt.end) {
                    throw new Error("Invalid event parameters")
                }
                return {
                    summary: evt.title,
                    description: evt.description,
                    location: evt.location,
                    start: {
                        dateTime: evt.start,
                        timeZone: timeZone
                    },
                    end: {
                        dateTime: evt.end,
                        timeZone: timeZone
                    }
                }
            })

            setGeneratedEvents(events)
            setStatus("review")
        } catch (e) {
            console.error(e)
            setStatus("error")
            setErrorMessage("Failed to parse event. Please try again.")
        }
    }

    const handleApprove = async () => {
        if (generatedEvents.length === 0) return
        setStatus("creating")
        try {
            // Create all events in parallel
            await Promise.all(generatedEvents.map(evt => createEvent(evt)))

            setStatus("success")
            setTimeout(() => {
                setIsOpen(false)
                setTextInput("")
                setGeneratedEvents([])
                setStatus("idle")
            }, 2000)
        } catch (e) {
            setStatus("error")
            setErrorMessage(e.message)
        }
    }

    const handleRetry = () => {
        setGeneratedEvents([])
        setStatus("idle")
    }

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 font-sans">
            {/* Main Modal */}
            {isOpen && (
                <div className="mb-4 w-96 bg-white/90 backdrop-blur-xl rounded shadow-2xl border border-white/50 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">

                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <h2 className="font-semibold text-gray-800">
                            {status === "review" ? `Review (${generatedEvents.length})` : "New Event"}
                        </h2>
                        <button onClick={toggleOverlay} className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-4">
                        {/* Capability Check / Download View */}
                        {capabilityStatus !== "available" && capabilityStatus !== "unknown" ? (
                            <div className="flex flex-col items-center text-center py-4 space-y-3">
                                <Download size={32} className="text-blue-600" />
                                <div>
                                    <h3 className="font-bold text-gray-800">
                                        {capabilityStatus === "no" ? "Model Not Available" : "AI Model Needed"}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {capabilityStatus === "no"
                                            ? "The model is not available in your browser, but you can try downloading it anyway."
                                            : "A small AI model (Gemini Nano) needs to be downloaded to your browser."}
                                    </p>
                                </div>

                                {isDownloading ? (
                                    <div className="w-full max-w-xs mt-2">
                                        <div className="bg-gray-200 rounded-full h-2 w-full">
                                            <div
                                                className="bg-blue-600 h-2 rounded-full transition-all"
                                                style={{ width: `${downloadProgress * 100}%` }}
                                            ></div>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-2">
                                            Downloading... {Math.round(downloadProgress * 100)}%
                                        </p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleDownloadModel}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
                                    >
                                        Download Model
                                    </button>
                                )}
                            </div>
                        ) : (status === "idle" || status === "generating" || status === "error" ? (
                            <>
                                <div className="relative">
                                    <textarea
                                        className="w-full h-32 p-3 bg-gray-50 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-700 placeholder-gray-400"
                                        placeholder="Describe your event... e.g. 'Coffee with Ryan tomorrow at 10am'"
                                        value={textInput}
                                        onChange={(e) => setTextInput(e.target.value)}
                                        disabled={status === "generating"}
                                    />

                                    <button
                                        className={`absolute bottom-3 right-3 p-2 rounded-full transition-colors ${isListening ? "bg-red-100 text-red-600 animate-pulse" : "bg-white text-gray-500 hover:bg-gray-200"}`}
                                        onClick={isListening ? stopListening : startListening}
                                        disabled={status === "generating"}
                                    >
                                        <Mic size={18} />
                                    </button>
                                </div>

                                {status === "error" && (
                                    <p className="text-red-500 text-sm mt-2">
                                        {errorMessage || "Something went wrong."}
                                    </p>
                                )}

                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={handleGenerate}
                                        disabled={!textInput.trim() || status === "generating" || !ready}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-medium shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                                    >
                                        {status === "generating" ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
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
                            <div className="space-y-4">
                                {status === "success" ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-green-600">
                                        <div className="p-3 bg-green-100 rounded-full mb-3">
                                            <Check size={32} />
                                        </div>
                                        <p className="font-semibold">Events Created!</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="max-h-60 overflow-y-auto space-y-2 px-1">
                                            {generatedEvents.map((evt, idx) => (
                                                <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-1">
                                                    <h3 className="font-bold text-sm">{evt.summary}</h3>
                                                    <div className="text-xs text-gray-600">
                                                        <p>📅 {evt.start.dateTime ? new Date(evt.start.dateTime).toLocaleString() : ""}</p>
                                                        {evt.location && <p>📍 {evt.location}</p>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex justify-between gap-2">
                                            <button
                                                onClick={handleRetry}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
                                            >
                                                <RefreshCcw size={16} />
                                                <span>Retry</span>
                                            </button>
                                            <button
                                                onClick={handleApprove}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium shadow-lg shadow-green-600/20 transition-all active:scale-95"
                                            >
                                                {status === "creating" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                <span>Approve All</span>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Floating Trigger Button */}
            {!isOpen && (
                <button
                    onClick={toggleOverlay}
                    className="p-2 bg-white/10 backdrop-blur-md text-white rounded-full shadow-2xl hover:shadow-blue-600/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-xs"
                >
                    <CalendarPlus size={14} />
                    <span>Plan Events</span>
                </button>
            )}
        </div>
    )
}
