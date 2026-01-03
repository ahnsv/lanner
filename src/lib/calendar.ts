export interface CalendarEvent {
    summary: string
    description?: string
    location?: string
    start: {
        dateTime: string
        timeZone?: string
    }
    end: {
        dateTime: string
        timeZone?: string
    }
}

export const getAuthToken = (): Promise<string> => {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                reject(chrome.runtime.lastError?.message || "No token received")
            } else {
                resolve(token)
            }
        })
    })
}

export const createEventDirect = async (event: CalendarEvent) => {
    const token = await getAuthToken()

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

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || "Failed to create event")
    }

    return response.json()
}

export const createEvent = async (event: CalendarEvent) => {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { type: "CREATE_EVENT", payload: event },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError)
                } else if (response.error) {
                    reject(new Error(response.error))
                } else {
                    resolve(response.data)
                }
            }
        )
    })
}
