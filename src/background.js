let sidePanels = {};
let tabId;

// Listen for messages from the side panel or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background onMessage', message, sender);

    if (message.type === 'sidePanelOpened') {
         // Ensure we return true immediately to keep the message channel open
		 handleSidePanelOpened().then(sendResponse({ success: true })).catch((error) => {
            console.error('Error handling sidePanelOpened:', error.message);
            sendResponse({ success: false, error: error.message });
        });
        return true; // Keep the message channel open for async response
    }

    if (message.type === 'chatMessageDetected') {
        console.log('Received chatMessageDetected:', message);
        // Handle received chat message here, if applicable
        sendResponse({ success: true });
    }

	async function handleSidePanelOpened() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                throw new Error("No active tab found.");
            }

            tabId = tabs[0].id;
            console.log('Background sidePanelOpened message received. Tab ID:', tabId);

            if (!sidePanels[tabId]) {
                sidePanels[tabId] = { isOpen: true };
            }

            await chrome.tabs.sendMessage(tabId, { type: 'activateObserver', tabId });

            console.log("Observer activated successfully");
            return { success: true };
        } catch (error) {
            console.error('Error in handleSidePanelOpened:', error.message);
            return { success: false, error: error.message };
        }
    }
});
