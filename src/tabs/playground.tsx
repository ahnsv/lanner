import { useState, useEffect } from "react"
import { useStructuredPrompt } from "@ahnopologetic/use-prompt-api/react"
import { z } from "zod"

import "../style.css"

const eventSchema = z.object({
    title: z.string(),
    start: z.string().describe("ISO 8601 string, e.g. 2024-01-01T12:00:00"),
    end: z.string().describe("ISO 8601 string"),
    location: z.string().optional(),
    description: z.string().optional()
})

export default function Playground() {
    const [input, setInput] = useState("")
    const [result, setResult] = useState<any>(null)

    // improved debug states
    const [capabilityStatus, setCapabilityStatus] = useState<string>("unknown")
    const [downloadProgress, setDownloadProgress] = useState<number>(0)
    const [isDownloading, setIsDownloading] = useState(false)

    const { prompt, ready, loading, error } = useStructuredPrompt({
        schema: eventSchema,
        systemPrompt: `You are a helpful calendar assistant. 
        The current date is ${new Date().toDateString()}.
        The current year is ${new Date().getFullYear()}.
        
        Rules:
        1. Extract event details into JSON.
        2. 'start' and 'end' MUST be valid ISO 8601 strings (e.g., "2024-01-01T14:00:00").
        3. If no end time is specified, assume 1 hour duration.
        4. If no date is specified, assume tomorrow.
        5. Infer relative dates (e.g., "next Friday") from the current date.
        `
    })

    useEffect(() => {
        checkCapabilities()
    }, [])

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
            setCapabilityStatus(`Download failed: ${e.message}`)
        } finally {
            setIsDownloading(false)
        }
    }

    const handleGenerate = async () => {
        if (!input.trim()) return
        setResult(null)
        const data = await prompt(`Create an event plan for: ${input}`)
        setResult(data)
    }

    return (
        <div className="plasmo-p-8 plasmo-bg-gray-100 plasmo-min-h-screen plasmo-font-sans">
            <div className="plasmo-max-w-2xl plasmo-mx-auto plasmo-bg-white plasmo-p-6 plasmo-rounded-xl plasmo-shadow-lg">
                <h1 className="plasmo-text-2xl plasmo-font-bold plasmo-mb-4">
                    AI Playground (use-prompt-api)
                </h1>

                <div className="plasmo-mb-4 plasmo-p-4 plasmo-bg-blue-50 plasmo-rounded-lg">
                    <p className="plasmo-font-semibold">
                        Library Status: {ready ? "Ready" : "Initializing..."}
                    </p>
                    <div className="plasmo-mt-2 plasmo-text-sm plasmo-text-gray-700">
                        <p><strong>Browser Capability:</strong> {capabilityStatus}</p>

                        {/* Show download interface if not ready */}
                        {capabilityStatus !== "readily" && capabilityStatus !== "unknown" && (
                            <div className="plasmo-mt-2">
                                <p className="plasmo-text-amber-600 plasmo-mb-1">
                                    {capabilityStatus === "no"
                                        ? "Model not available (try downloading anyway)"
                                        : "Model needs download."}
                                </p>
                                {isDownloading ? (
                                    <div className="plasmo-w-full plasmo-bg-gray-200 plasmo-rounded-full plasmo-h-2.5">
                                        <div
                                            className="plasmo-bg-blue-600 plasmo-h-2.5 plasmo-rounded-full plasmo-transition-all"
                                            style={{ width: `${downloadProgress * 100}%` }}
                                        ></div>
                                        <p className="plasmo-text-xs plasmo-mt-1">{Math.round(downloadProgress * 100)}%</p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleDownloadModel}
                                        className="plasmo-px-3 plasmo-py-1 plasmo-bg-blue-600 plasmo-text-white plasmo-text-xs plasmo-rounded hover:plasmo-bg-blue-700"
                                    >
                                        Download Model
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="plasmo-text-sm plasmo-text-red-600 plasmo-mt-2">
                            Library Error: {error.message}
                        </p>
                    )}
                </div>

                <textarea
                    className="plasmo-w-full plasmo-p-3 plasmo-border plasmo-rounded-lg plasmo-mb-4 plasmo-h-32 focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500"
                    placeholder="e.g. Lunch with John tomorrow at 12pm..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />

                <button
                    onClick={handleGenerate}
                    disabled={loading || !ready}
                    className="plasmo-px-6 plasmo-py-2 plasmo-bg-blue-600 plasmo-text-white plasmo-rounded-lg hover:plasmo-bg-blue-700 disabled:plasmo-opacity-50 plasmo-transition-colors"
                >
                    {loading ? "Generating..." : "Generate Plan"}
                </button>

                {result && (
                    <div className="plasmo-mt-6">
                        <h2 className="plasmo-font-semibold plasmo-mb-2">Output:</h2>
                        <pre className="plasmo-bg-gray-900 plasmo-text-green-400 plasmo-p-4 plasmo-rounded-lg plasmo-overflow-x-auto">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div >
    )
}
