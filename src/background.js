let originalTabId = null;

// Listen for messages from the side panel or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background onMessage', message, sender);

	async function handleSidePanelOpened() {
		console.log('Background sidePanelOpened handleSidePanelOpened');
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                throw new Error("No active tab found.");
            }

            originalTabId = tabs[0].id;
            console.log('Background sidePanelOpened message received. Tab ID:', originalTabId);

            chrome.tabs.sendMessage(originalTabId, { type: 'activateObserver', tabId: originalTabId });

            console.log("Observer activated successfully");
            return { success: true };
        } catch (error) {
            console.error('Error in handleSidePanelOpened:', error.message);
            return { success: false, error: error.message };
        }
    }
});

// Listen for tab activation events
chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log('Background Tab activated:', activeInfo);
    const tabId = activeInfo.tabId;

    // If there's an originalTabId and it differs from the current tabId
    if (originalTabId && tabId !== originalTabId) {
        // Notify the side panel about the tab change
        chrome.runtime.sendMessage({ type: 'notOriginalTab' })
    }
});

// Optionally, listen for when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    console.log('Background Tab removed:', tabId);
    if (tabId === originalTabId) {
        originalTabId = null; // Clear originalTabId if the original tab is closed
    }
});
