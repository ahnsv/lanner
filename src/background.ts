import { createEventDirect } from "~lib/calendar"

export { }

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "CREATE_EVENT") {
        console.debug("Creating event:", request.payload)
        const result = createEventDirect(request.payload)
            .then((data) => sendResponse({ data }))
            .catch((error) => sendResponse({ error: error.message }))

        console.debug("Result:", result)
        // Return true to indicate async response
        return true
    }
})
