console.log('Background script loaded');
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Background - Fresh installation detected');
        // Add your initialization code here
    } else if (details.reason === 'update') {
        console.log('Background - Extension updated from version', details.previousVersion);
    }
});
