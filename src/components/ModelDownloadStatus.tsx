import { useState, useEffect } from "react"
import { Download, RefreshCw } from "lucide-react"

interface ModelDownloadStatusProps {
    availability: string
}

export function ModelDownloadStatus({ availability }: ModelDownloadStatusProps) {
    const [downloadProgress, setDownloadProgress] = useState<number>(0)
    const [isDownloading, setIsDownloading] = useState(false)
    const [restartRequired, setRestartRequired] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Check if restart was previously requested
        chrome.storage.local.get("restartRequired", (result) => {
            if (result.restartRequired) {
                // If availability is now "readily" (or "available"), then the restart likely happened or model became available
                // But typically if we just set the flag, we want to show the message until they restart.
                // However, if the model IS available, we shouldn't block them.
                if (availability === "readily" || availability === "available") { // "available" is often used as a convenient alias if the upstream lib uses it, though Prompt API uses "readily" usually. 
                    // actually looking at the previous file, it used 'availability !== "available"'
                    // effectively clearing it if it works now.
                    chrome.storage.local.remove("restartRequired")
                    setRestartRequired(false)
                } else {
                    setRestartRequired(true)
                }
            }
        })
    }, [availability])

    const handleDownloadModel = async () => {
        setIsDownloading(true)
        setError(null)
        try {
            // @ts-ignore - LanguageModel is global in this context
            await LanguageModel.create({
                monitor(m: any) {
                    m.addEventListener("downloadprogress", (e: any) => {
                        console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`)
                        // Sometimes total is 0 or undefined if unknown
                        if (e.total > 0) {
                            setDownloadProgress(e.loaded / e.total)
                        }
                    })
                },
            })
            // If we get here, download finished successfully (or at least the create call finished)
            // Ideally we'd wait for confirm, but usually this means it's ready or needs restart.
            // For Chrome built-in AI, often a restart is needed after first download.

            setRestartRequired(true)
            chrome.storage.local.set({ restartRequired: true })

        } catch (e: any) {
            console.error(e)
            setError(`Download failed: ${e.message}`)
        } finally {
            setIsDownloading(false)
        }
    }

    if (restartRequired) {
        return (
            <div className="flex flex-col items-center text-center py-6 space-y-4">
                <div className="p-4 bg-yellow-500/10 rounded-full ring-1 ring-yellow-500/20">
                    <RefreshCw size={24} className="text-yellow-400" />
                </div>
                <div className="space-y-1">
                    <h3 className="font-semibold text-white tracking-tight">Restart Required</h3>
                    <p className="text-sm text-gray-400 max-w-xs mx-auto">
                        Please restart Chrome to finish enabling the AI model.
                    </p>
                </div>
                <div className="text-xs text-white/30">
                    chrome://restart
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center text-center py-6 space-y-4">
            <div className="p-4 bg-white/5 rounded-full ring-1 ring-white/10">
                <Download size={24} className="text-blue-400" />
            </div>
            <div className="space-y-1">
                <h3 className="font-semibold text-white tracking-tight">
                    AI Model Needed
                </h3>
                <p className="text-sm text-gray-400 max-w-xs mx-auto">
                    A small AI model needs to be downloaded to your browser.
                </p>
            </div>

            {isDownloading ? (
                <div className="w-full max-w-xs space-y-2">
                    <div className="bg-white/10 rounded-full h-1 w-full overflow-hidden">
                        <div
                            className="bg-blue-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${downloadProgress * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono text-right">
                        {Math.round(downloadProgress * 100)}%
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <button
                        onClick={handleDownloadModel}
                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm rounded-xl font-medium transition-all shadow-lg shadow-blue-900/20 active:scale-95"
                    >
                        Download Model
                    </button>
                    {error && (
                        <p className="text-xs text-red-400 max-w-xs">{error}</p>
                    )}
                </div>
            )}
        </div>
    )
}
