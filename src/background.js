if (chrome.sidePanel) {
	chrome.sidePanel
		.setPanelBehavior({ openPanelOnActionClick: true })
		.catch((error) => console.error(error));
} else {
	console.error("Side Panel API is not supported in this context.");
}
