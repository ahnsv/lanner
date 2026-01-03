import { useState } from "react"
import "../style.css"

export default function AuthTest() {
    const [token, setToken] = useState("")
    const [status, setStatus] = useState("")
    const [events, setEvents] = useState<any[]>([])

    const getAuthToken = () => {
        setStatus("Getting token...")
        chrome.identity.getAuthToken({ interactive: true }, (authToken) => {
            if (chrome.runtime.lastError) {
                setStatus(`Error: ${chrome.runtime.lastError.message}`)
                return
            }
            setToken(authToken)
            setStatus("Token received!")
        })
    }

    const listEvents = async () => {
        if (!token) return
        setStatus("Fetching events...")
        try {
            const response = await fetch(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=5&orderBy=startTime&singleEvents=true",
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )
            const data = await response.json()
            if (data.error) {
                throw new Error(data.error.message)
            }
            setEvents(data.items || [])
            setStatus("Events fetched!")
        } catch (e) {
            setStatus(`Error fetching events: ${e.message}`)
        }
    }

    const createTestEvent = async () => {
        if (!token) return
        setStatus("Creating event...")
        const event = {
            summary: "Test Event from Chrome Extension",
            location: "Virtual",
            description: "This is a test event created via the Calendar API.",
            start: {
                dateTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
            },
            end: {
                dateTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
            },
        }

        try {
            const response = await fetch(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(event),
                }
            )
            const data = await response.json()
            if (data.error) {
                throw new Error(data.error.message)
            }
            setStatus(`Event created! ID: ${data.id}`)
            listEvents() // Refresh list
        } catch (e) {
            setStatus(`Error creating event: ${e.message}`)
        }
    }

    return (
        <div className="p-8 bg-gray-100 min-h-screen font-sans">
            <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-lg">
                <h1 className="text-2xl font-bold mb-4">
                    Google Calendar API Test
                </h1>

                <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="font-medium text-yellow-800">
                        Status: {status || "Idle"}
                    </p>
                    {token && (
                        <p className="text-xs text-gray-500 mt-2 break-all">
                            Token: {token.substring(0, 20)}...
                        </p>
                    )}
                </div>

                <div className="flex gap-4 mb-8">
                    <button
                        onClick={getAuthToken}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    >
                        1. Authorize
                    </button>

                    <button
                        onClick={listEvents}
                        disabled={!token}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition"
                    >
                        2. List Events
                    </button>

                    <button
                        onClick={createTestEvent}
                        disabled={!token}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition"
                    >
                        3. Create Test Event
                    </button>
                </div>

                <div>
                    <h2 className="font-bold text-lg mb-3">Upcoming Events</h2>
                    {events.length === 0 ? (
                        <p className="text-gray-500 italic">No events fetched yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {events.map((evt) => (
                                <li key={evt.id} className="p-3 bg-gray-50 rounded border">
                                    <p className="font-semibold">{evt.summary || "(No Title)"}</p>
                                    <p className="text-sm text-gray-600">
                                        {evt.start.dateTime ? new Date(evt.start.dateTime).toLocaleString() : evt.start.date}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}
