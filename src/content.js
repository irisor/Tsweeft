console.log('Content script loaded');
let tabId = null;

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const inputMessage = document.querySelector('.chatbot-messages');
    const outputMessage = document.querySelector('.chatbot-input');
    let observer = null;
    let isObserving = false;

    console.log('Content onMessage', message, sender);

    if (message.type === 'sidePanelOpened') {
        
        tabId = message.tabId;
        console.log('Activating observer on this tab.', tabId);

        observerElement(inputMessage);
        sendResponse({ success: true });
        
        return true;
        function observerElement(targetElement) {
            console.log('Content.js observerElement', targetElement);

            if (!targetElement) {
                console.log('Messages to translate not found');
                return;
            }
            sendText(targetElement.innerText);
            // Observer setup
            if (inputMessage) {
                // const observer = new MutationObserver((mutations) => {
                observer = new MutationObserver(debounce((mutations) => {
                    if (mutations.some(m => m.type === 'childList' || m.type === 'characterData')) {
                        sendText(inputMessage.innerText);
                    }
                }, 500));

                observer.observe(inputMessage, { childList: true, subtree: true });
                isObserving = true;
                console.log('Observer initialized for inputMessage.');

                // Clean up observer on unload
                window.addEventListener('beforeunload', () => {
                    console.log('content before unload, observer=', observer, isObserving);
                    
                    if (observer && isObserving) {
                        observer.disconnect();
                        isObserving = false;
                        chrome.runtime.sendMessage({ type: 'closeSidePanel' });
                    }
                });
            } else {
                console.warn('No input message found to observe.');
            }

            function sendText(newText) {
                if (!newText) return;

                console.log('content before sendMessage chatMessageDetected');
                // Send message to background script
                console.log('Tsweeft detected new message: %s', newText);

                chrome.runtime.sendMessage({
                    type: 'chatMessageDetected',
                    tabId: message.tabId,
                    text: newText
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error in sending chatMessageDetected:', chrome.runtime.lastError.message);
                    } else {
                        console.log('chatMessageDetected Message sent successfully:', response);
                    }
                });
            }
        }
    }

    if (message.type === 'injectTextIntoChat') {
        injectTextIntoChat(message.text);
        sendResponse({ success: true });
    }

    if (message.type === 'sidePanelClosed') {
        console.log('content sidePanelClosed', message);

        // Clean up the observer when the side panel is closed
        if (observer) {
            observer.disconnect();
            isObserving = false;
        }
    }

    function injectTextIntoChat(translatedText) {
        const targetElement = outputMessage;
        if (targetElement) {
            targetElement.value = translatedText;
            const event = new Event('input', { bubbles: true });
            targetElement.dispatchEvent(event); // Trigger chat app to recognize input
        }
    };
});

function debounce(func, time) {
	let timeoutId;
	return (...args) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			func(...args);
			timeoutId = null;
		}, time);
	};
}