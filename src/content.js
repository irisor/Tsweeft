console.log('Content script loaded');
let tabId = null;
let observer = null;
let isObserving = false;
let chatArea = null;
let inputArea = null;
let isSelectionMode = false;
let overlay = null;
let activeHighlighter = null;
let permanentHighlighters = {
    chatArea: null,
    inputArea: null
};
let lastChatLength = 0;
let lastChatMyMessage = '';

// Cleanup function to handle observer disconnection
function cleanup() {
    lastChatLength = 0;
    lastChatMyMessage = '';
    cleanupObserver();
}

function cleanupObserver() {
    if (observer && isObserving) {
        console.log('Cleaning up observer');
        observer.disconnect();
        observer = null;
        isObserving = false;
    }
}

setupMessageListeners();

function setupMessageListeners() {

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

        console.log('Content onMessage', message, sender);

        switch (message.type) {

            case "startElementSelection":
                startElementSelection(message.elementType);
                break;

            case "sidePanelOpened":
                tabId = message.tabId;
                if (!tabId) {
                    console.log('side panel opened without tabId, ignoring');
                    return;
                }
                initElementSelectionUI();
                cleanup();
                console.log('Activating observer on this tab.', tabId);
                sendResponse({ success: true });
                return true;

            case "sidePanelClosed":
                console.log('content sidePanelClosed', message);
                cleanup();
                sendResponse({ success: true });
                return true;

            case "injectTextIntoChat":
                injectTextIntoChat(message.text);
                sendResponse({ success: true });
                return true;

            default:
                console.log('Unrecognized message type:', message.type);
                break;
        }
    });
}

function observerElement(targetElement) {
    console.log('Content.js observerElement', targetElement);

    if (!targetElement) {
        console.log('Messages to translate not found');
        return;
    }

    sendChatToSidepanel(targetElement.innerText);

    // Observer setup
    if (targetElement) {
        observer = new MutationObserver(debounce((mutations) => {
            if (mutations.some(m => m.type === 'childList' || m.type === 'characterData')) {
                sendChatToSidepanel(targetElement.innerText);
            }
        }, 500));

        observer.observe(targetElement, { childList: true, subtree: true });
        isObserving = true;
        console.log('Observer initialized for inputMessage.');

        // Clean up observer on unload
        window.addEventListener('beforeunload', () => {
            console.log('content before unload, observer=', observer, isObserving);
            cleanup();

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

function sendChatToSidepanel(text) {
    if (!text) return;

    // Remove previous chat text from the text sent to the sidepanel, so that only new text wioll be displayed in the sidepanel
    let newText = text.substring(lastChatLength);
    if (newText) newText = removeStartString(newText, lastChatMyMessage); // Remove my last message


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

function removeStartString(fullString, startString) {
    // Remove leading whitespace and newlines from startString
    const startStringLength = startString.length;
    const startStringTrimmed = startString.trim();
  
    // Check if fullString starts with startString (ignoring whitespace)
    if (fullString.trim().startsWith(startStringTrimmed)) {
      // Remove startString from the beginning of fullString
      return fullString.trim().slice(startStringLength).trim();
    } else {
      // Return the original fullString if it doesn't start with startString
      return fullString;
    }
  }

function injectTextIntoChat(translatedText) {
    if (inputArea) {
        inputArea.value = translatedText;
        const event = new Event('input', { bubbles: true });
        inputArea.dispatchEvent(event);
        lastChatLength = chatArea.innerText.length;
        lastChatMyMessage = inputArea.value;
    }
}

async function initElementSelectionUI() {
    createOverlay();
    const chatElements = await detectChat();
    console.log('Chat elements detected:', chatElements);

    if (chatElements) {
        chatArea = chatElements.chatArea;
        inputArea = chatElements.inputArea;
    }
}

function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'chat-detector-overlay';

    document.body.appendChild(overlay);
}

async function detectChat() {
    // Common chat patterns to look for
    const patterns = {
        chatArea: [
            '[aria-label*="chat"]',
            '[class*="chat"]',
            '[id*="chat"]',
            '[class*="conversation"]',
            '[class*="messages"]'
        ],
        inputArea: [
            'textarea',
            '[contenteditable="true"]',
            'input[type="text"]',
            '[role="textbox"]'
        ]
    };

    // First try direct DOM
    let results = detectInCurrentDocument(patterns);
    if (results) return results;

    // Then try iframes
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
        try {
            results = await detectInIframe(iframe, patterns);
            if (results) return results;
        } catch (e) {
            console.warn('Failed to access iframe:', e);
        }
    }

    return null;
}

function detectInCurrentDocument(patterns) {
    for (const chatSelector of patterns.chatArea) {
        const chatElement = document.querySelector(chatSelector);
        if (chatElement) {
            // Find nearest input area
            for (const inputSelector of patterns.inputArea) {
                const inputElement = document.querySelector(inputSelector);
                if (inputElement && areElementsRelated(chatElement, inputElement)) {
                    return { chatArea: chatElement, inputArea: inputElement };
                }
            }
        }
    }
    return null;
}

async function detectInIframe(iframe, patterns) {
    // Create a temporary invisible overlay to intercept iframe interactions
    const overlay = document.createElement('div');
    overlay.style.cssText = `
    position: absolute;
    top: ${iframe.offsetTop}px;
    left: ${iframe.offsetLeft}px;
    width: ${iframe.offsetWidth}px;
    height: ${iframe.offsetHeight}px;
    z-index: 2147483647;
    background: transparent;
  `;

    document.body.appendChild(overlay);

    // Use MutationObserver to detect changes in iframe
    return new Promise((resolve) => {
        const observer = new MutationObserver((mutations) => {
            const iframeDoc = iframe.contentDocument;
            if (iframeDoc) {
                const result = detectInCurrentDocument.call(
                    { document: iframeDoc },
                    patterns
                );
                if (result) {
                    observer.disconnect();
                    overlay.remove();
                    resolve(result);
                }
            }
        });

        observer.observe(iframe, {
            attributes: true,
            childList: true,
            subtree: true
        });

        // Timeout after 5 seconds
        setTimeout(() => {
            observer.disconnect();
            overlay.remove();
            resolve(null);
        }, 5000);
    });
}

function areElementsRelated(chatElement, inputElement) {
    // Check if elements are likely related (e.g., share common ancestor)
    let commonAncestor = findCommonAncestor(chatElement, inputElement);
    if (!commonAncestor) return false;

    // Check if they're reasonably close in the DOM
    const distance = calculateDOMDistance(chatElement, inputElement);
    return distance < 10; // Arbitrary threshold
}

function findCommonAncestor(el1, el2) {
    const path1 = getPath(el1);
    const path2 = getPath(el2);

    let commonAncestor = null;
    for (let i = 0; i < path1.length && i < path2.length; i++) {
        if (path1[i] === path2[i]) {
            commonAncestor = path1[i];
        } else {
            break;
        }
    }
    return commonAncestor;
}

function getPath(element) {
    const path = [];
    while (element) {
        path.unshift(element);
        element = element.parentElement;
    }
    return path;
}

function calculateDOMDistance(el1, el2) {
    const path1 = getPath(el1);
    const path2 = getPath(el2);
    return path1.length + path2.length - 2 * findCommonAncestor(el1, el2).length;
}

function createHighlighter(className) {
    const highlighter = document.createElement('div');
    highlighter.className = `element-highlighter ${className}`;
    document.body.appendChild(highlighter);
    return highlighter;
}

function updateHighlighterPosition(highlighter, element) {
    if (!element || !highlighter) return;

    const rect = element.getBoundingClientRect();
    highlighter.style.top = `${rect.top + window.scrollY}px`;
    highlighter.style.left = `${rect.left + window.scrollX}px`;
    highlighter.style.width = `${rect.width}px`;
    highlighter.style.height = `${rect.height}px`;
    highlighter.style.display = 'block';
}

function startElementSelection(elementType) {
    // Clean up any existing selection mode
    if (isSelectionMode) {
        cleanupSelection();
    }

    isSelectionMode = true;
    overlay.style.pointerEvents = 'none';

    // Create temporary highlighter for hover effect
    activeHighlighter = createHighlighter('temp-highlighter');

    const handleMouseOver = (e) => {
        if (!isSelectionMode) return;

        const target = e.target;
        // Ignore highlighters and overlay
        if (target.classList.contains('element-highlighter') || target === overlay) return;

        updateHighlighterPosition(activeHighlighter, target);
    };

    const handleMouseOut = (e) => {
        if (!isSelectionMode) return;

        const target = e.target;
        if (target.classList.contains('element-highlighter') || target === overlay) return;

        activeHighlighter.style.display = 'none';
    };

    const handleClick = (e) => {
        if (!isSelectionMode) return;

        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        if (target.classList.contains('element-highlighter') || target === overlay) return;

        // Remove previous permanent highlighter for this element type if it exists
        if (permanentHighlighters[elementType]) {
            permanentHighlighters[elementType].remove();
        }

        // Create new permanent highlighter
        permanentHighlighters[elementType] = createHighlighter(`permanent-highlighter ${elementType}-highlighter`);
        updateHighlighterPosition(permanentHighlighters[elementType], target);

        // Update stored element reference
        if (elementType === 'chatArea') {
            chatArea = target;
        } else {
            inputArea = target;
        }

        cleanupObserver();
        observerElement(chatArea);

        // Clean up selection mode
        cleanupSelection(handleMouseOver, handleMouseOut, handleClick);
    };

    // Use capturing phase for events
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
}

function cleanupSelection(mouseOverHandler, mouseOutHandler, clickHandler) {
    if (mouseOverHandler) {
        document.removeEventListener('mouseover', mouseOverHandler, true);
    }
    if (mouseOutHandler) {
        document.removeEventListener('mouseout', mouseOutHandler, true);
    }
    if (clickHandler) {
        document.removeEventListener('click', clickHandler, true);
    }

    if (activeHighlighter) {
        activeHighlighter.remove();
        activeHighlighter = null;
    }

    isSelectionMode = false;
    if (overlay) {
        overlay.style.pointerEvents = 'auto';
    }
}

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