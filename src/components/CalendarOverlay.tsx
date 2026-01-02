import { useState, useEffect } from "react"
import { CalendarPlus, X, Mic, Send, Check, Loader2, RefreshCcw } from "lucide-react"
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

    const { isListening, transcript, startListening, stopListening, resetTranscript } = useSpeechRecognition()

    const { prompt, ready, loading: aiLoading } = useStructuredPrompt({
        schema: eventSchema,
        systemPrompt: `You are a helpful calendar assistant. The current time is ${new Date().toISOString()}.`
    })

    // Sync speech transcript to text input
    useEffect(() => {
        if (transcript) {
            // Append new transcript to input or replace? 
            // For now, let's just append or replace if empty
            // Actually simpler to just rely on user editing it if it's wrong
            setTextInput((prev) => prev ? prev + " " + transcript : transcript)
            resetTranscript()
        }
    }, [transcript, resetTranscript])

    const toggleOverlay = () => {
        setIsOpen(!isOpen)
        if (!isOpen) {
            // Reset state on open
            setGeneratedEvent(null)
            setStatus("idle")
        }
    }

    const handleGenerate = async () => {
        if (!textInput.trim() || !ready) return
        setStatus("generating")
        setErrorMessage("")

        try {
            const result = await prompt(`Create an event plan for: ${textInput}`)

            // Transform result to match CalendarEvent interface (ensure dateTime structure)
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
                        {status === "idle" || status === "generating" || status === "error" ? (
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
                        )}
                    </div>
                </div>
            )}

            {/* Floating Trigger Button */}
            <button
                onClick={toggleOverlay}
                className={`plasmo-flex plasmo-items-center plasmo-justify-center plasmo-w-14 plasmo-h-14 plasmo-rounded-full plasmo-shadow-xl plasmo-transition-all plasmo-duration-300 hover:plasmo-scale-110 active:plasmo-scale-95 ${isOpen
                        ? "plasmo-bg-gray-800 plasmo-rotate-45"
                        : "plasmo-bg-gradient-to-tr plasmo-from-blue-600 plasmo-to-purple-600"
                    }`}
            >
                <CalendarPlus
                    size={24}
                    className={`${isOpen ? "plasmo-text-gray-400" : "plasmo-text-white"}`}
                />
            </button>
        </div>
    )
}
