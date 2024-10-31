console.log('Content script loaded');
let tabId = null;
let observer = null;
let isObserving = false;

// Cleanup function to handle observer disconnection
function cleanupObserver() {
    if (observer && isObserving) {
        console.log('Cleaning up observer');
        observer.disconnect();
        observer = null;
        isObserving = false;
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const inputMessage = document.querySelector('.chatbot-messages');
    const outputMessage = document.querySelector('.chatbot-input');

    console.log('Content onMessage', message, sender);

    if (message.type === 'sidePanelOpened') {
        tabId = message.tabId;
        if (!tabId) {
            console.log('side panel opened without tabId, ignoring');
            return;
        }

        // Clean up any existing observer before creating a new one
        cleanupObserver();

        console.log('Activating observer on this tab.', tabId);
        observerElement(inputMessage);
        sendResponse({ success: true });

        return true;
    }

    if (message.type === 'sidePanelClosed') {
        console.log('content sidePanelClosed', message);
        cleanupObserver();
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'injectTextIntoChat') {
        injectTextIntoChat(message.text);
        sendResponse({ success: true });
        return true;
    }

    function observerElement(targetElement) {
        console.log('Content.js observerElement', targetElement);

        if (!targetElement) {
            console.log('Messages to translate not found');
            return;
        }

        sendText(targetElement.innerText);

        // Observer setup
        if (targetElement) {
            observer = new MutationObserver(debounce((mutations) => {
                if (mutations.some(m => m.type === 'childList' || m.type === 'characterData')) {
                    sendText(targetElement.innerText);
                }
            }, 500));

            observer.observe(targetElement, { childList: true, subtree: true });
            isObserving = true;
            console.log('Observer initialized for inputMessage.');

            // Clean up observer on unload
            window.addEventListener('beforeunload', () => {
                console.log('content before unload, observer=', observer, isObserving);
                cleanupObserver();

                try {
                    chrome.runtime.sendMessage({ type: 'closeSidePanel' });
                } catch (error) {
                    console.log('Content attempted to close side panel, but failed:', error);
                }
            });
        } else {
            console.warn('No input message found to observe.');
        }
    }

    function sendText(newText) {
        if (!newText) return;

        console.log('Tsweeft detected new message: %s', newText);

        chrome.runtime.sendMessage({
            type: 'chatMessageDetected',
            tabId: tabId,
            text: newText
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.log('Error in sending chatMessageDetected:', chrome.runtime.lastError.message, tabId, newText);
            } else {
                console.log('chatMessageDetected Message sent successfully:', response);
            }
        });
    }

    function injectTextIntoChat(translatedText) {
        if (outputMessage) {
            outputMessage.value = translatedText;
            const event = new Event('input', { bubbles: true });
            outputMessage.dispatchEvent(event);
        }
    }
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