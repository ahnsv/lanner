import { createEventDirect } from "~lib/calendar"

export { }

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "CREATE_EVENT") {
        createEventDirect(request.payload)
            .then((data) => sendResponse({ data }))
            .catch((error) => sendResponse({ error: error.message }))

        // Return true to indicate async response
        return true
    }
})
