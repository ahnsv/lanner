import { useState, useCallback, useEffect } from "react"

export function useSpeechRecognition() {
    const [isListening, setIsListening] = useState(false)
    const [transcript, setTranscript] = useState("")
    const [recognition, setRecognition] = useState<any>(null)

    useEffect(() => {
        if (typeof window !== "undefined" && (window as any).webkitSpeechRecognition) {
            const r = new (window as any).webkitSpeechRecognition()
            r.continuous = true
            r.interimResults = true
            r.lang = "en-US"

            r.onresult = (event: any) => {
                let final = ""
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript
                    }
                }
                if (final) {
                    setTranscript((prev) => prev + " " + final)
                }
            }

            r.onend = () => {
                setIsListening(false)
            }

            setRecognition(r)
        }
    }, [])

    const startListening = useCallback(() => {
        if (recognition) {
            try {
                recognition.start()
                setIsListening(true)
            } catch (e) {
                console.error("Speech recognition error:", e)
            }
        }
    }, [recognition])

    const stopListening = useCallback(() => {
        if (recognition) {
            recognition.stop()
            setIsListening(false)
        }
    }, [recognition])

    const resetTranscript = useCallback(() => {
        setTranscript("")
    }, [])

    return { isListening, transcript, startListening, stopListening, resetTranscript }
}
