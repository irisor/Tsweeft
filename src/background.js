let originalTabId = null;


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
