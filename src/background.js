// console.log("Background script loaded");
// let tabId = null;
// initBackground();

// async function initBackground() {
// 	await chrome.sidePanel.setOptions({
// 		enabled: false
// 	});
// }

// chrome.action.onClicked.addListener((tab) => {
// 	// Initialize the detection process
// 	console.log("Background: Send message to content script");
// 	chrome.tabs.sendMessage(tab.id, { type: "initDetection" });
// 	tabId = tab.id;
// });

// // Handle messages from content script
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
// 	if (message.type === "openSidePanel") {
// 		chrome.sidePanel.setOptions({
// 			path: "public/sidepanel.html",
// 			tabId: tabId,
// 			enabled: true
// 		});
// 		chrome.sidePanel.open({ windowId: sender.tab.windowId });
// 	}
// });