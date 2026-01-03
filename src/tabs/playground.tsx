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
        <div className="p-8 bg-gray-100 min-h-screen font-sans">
            <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-lg">
                <h1 className="text-2xl font-bold mb-4">
                    AI Playground (use-prompt-api)
                </h1>

                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <p className="font-semibold">
                        Library Status: {ready ? "Ready" : "Initializing..."}
                    </p>
                    <div className="mt-2 text-sm text-gray-700">
                        <p><strong>Browser Capability:</strong> {capabilityStatus}</p>

                        {/* Show download interface if not ready */}
                        {capabilityStatus !== "readily" && capabilityStatus !== "unknown" && (
                            <div className="mt-2">
                                <p className="text-amber-600 mb-1">
                                    {capabilityStatus === "no"
                                        ? "Model not available (try downloading anyway)"
                                        : "Model needs download."}
                                </p>
                                {isDownloading ? (
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div
                                            className="bg-blue-600 h-2.5 rounded-full transition-all"
                                            style={{ width: `${downloadProgress * 100}%` }}
                                        ></div>
                                        <p className="text-xs mt-1">{Math.round(downloadProgress * 100)}%</p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleDownloadModel}
                                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                    >
                                        Download Model
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 mt-2">
                            Library Error: {error.message}
                        </p>
                    )}
                </div>

                <textarea
                    className="w-full p-3 border rounded-lg mb-4 h-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Lunch with John tomorrow at 12pm..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />

                <button
                    onClick={handleGenerate}
                    disabled={loading || !ready}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {loading ? "Generating..." : "Generate Plan"}
                </button>

                {result && (
                    <div className="mt-6">
                        <h2 className="font-semibold mb-2">Output:</h2>
                        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div >
    )
}
