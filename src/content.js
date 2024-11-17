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

    // Cleanup permanent highlighter variables and html classes
    removeHighlighters();
    Object.keys(permanentHighlighters).forEach((key) => {
        if (!permanentHighlighters[key]) return;
        permanentHighlighters[key].remove();
        permanentHighlighters[key] = null;
    });

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
                sendResponse({ success: true });
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
                break;

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
   console.log('detectChat');

    return null;
}

function getPath(element) {
    const path = [];
    while (element) {
        path.unshift(element);
        element = element.parentElement;
    }
    return path;
}

function createHighlighter(className, referenceElement=null) {
    const highlighter = document.createElement('div');
    highlighter.className = `element-highlighter ${className}`;
    if (referenceElement) {
        highlighter.referenceElement = referenceElement; // Add reference element property
    }
    document.body.appendChild(highlighter);
    return highlighter;
}

function removeHighlighters() {
    const highlighters = document.querySelectorAll('.element-highlighter');
    for (const highlighter of highlighters) {
        highlighter.remove();
    }
}

function getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    
    // Get all scroll positions up to the root
    let scrollX = 0;
    let scrollY = 0;
    let currentElement = element;
    
    while (currentElement && currentElement !== document.body && currentElement !== document.documentElement) {
        const parent = currentElement.parentElement;
        if (!parent) break;
        
        // Check if the parent creates a new positioning context
        const position = window.getComputedStyle(parent).position;
        if (position === 'relative' || position === 'absolute' || position === 'fixed' || position === 'sticky') {
            const parentRect = parent.getBoundingClientRect();
            scrollX -= parentRect.left;
            scrollY -= parentRect.top;
            
            if (position === 'fixed') {
                // For fixed elements, we don't want to include the scroll offset
                break;
            }
        }
        
        if (parent.scrollLeft || parent.scrollTop) {
            scrollX += parent.scrollLeft;
            scrollY += parent.scrollTop;
        }
        
        currentElement = parent;
    }
    
    // For elements within fixed/sticky containers, we need to adjust for scroll
    const elementPosition = window.getComputedStyle(element).position;
    const hasFixedAncestor = hasFixedParent(element);
    
    if (!hasFixedAncestor && elementPosition !== 'fixed') {
        scrollX += window.pageXOffset;
        scrollY += window.pageYOffset;
    }
    
    return {
        top: rect.top + scrollY,
        left: rect.left + scrollX,
        width: rect.width,
        height: rect.height
    };
}

function hasFixedParent(element) {
    let current = element.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
        const position = window.getComputedStyle(current).position;
        if (position === 'fixed') {
            return true;
        }
        current = current.parentElement;
    }
    return false;
}

function updateHighlighterPosition(highlighter) {
    if (!highlighter || !highlighter.referenceElement) return;

    // Set initial styles for the highlighter
    highlighter.style.position = 'fixed';  // Changed to fixed positioning
    highlighter.style.pointerEvents = 'none';
    highlighter.style.zIndex = '2147483647'; // Max z-index to ensure visibility

    const rect = highlighter.referenceElement.getBoundingClientRect();
    highlighter.style.top = `${rect.top}px`;
    highlighter.style.left = `${rect.left}px`;
    highlighter.style.width = `${rect.width}px`;
    highlighter.style.height = `${rect.height}px`;
}

function startElementSelection(elementType) {
    // Clean up any existing selection mode
    if (isSelectionMode) {
        cleanupSelection();
    }

    isSelectionMode = true;
    if (overlay) overlay.style.pointerEvents = 'none';

    // Create temporary highlighter for hover effect
    activeHighlighter = createHighlighter('temp-highlighter');

    const handleMouseOver = debounce((e) => {
        if (!isSelectionMode) return;

        const target = e.target;
        // Ignore highlighters and overlay
        if (target.classList.contains('element-highlighter') || target === overlay) return;
        activeHighlighter.referenceElement = target;

        updateHighlighterPosition(activeHighlighter);
    }, 100);

    const handleMouseOut = (e) => {
        if (!isSelectionMode) return;

        const target = e.target;
        if (target.classList.contains('element-highlighter') || target === overlay) return;

        if (activeHighlighter.target) activeHighlighter.style.display = 'none';
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
        permanentHighlighters[elementType] = createHighlighter(`permanent-highlighter ${elementType}-highlighter`, target);
        updateHighlighterPosition(permanentHighlighters[elementType]);

        // Update stored element reference
        if (elementType === 'chatArea') {
            chatArea = target;
            cleanupObserver();
            observerElement(chatArea);
        } else {
            inputArea = target;
            let inputOrTextarea = inputArea.querySelector('input, textarea');

            // Set the inputArea on the inner input or textarea
            while (!inputOrTextarea && inputArea.children.length) {
                inputArea = inputArea.children[0];
                inputOrTextarea = inputArea.querySelector('input, textarea');
            }
            inputArea = inputOrTextarea || inputArea;
        }

        // Clean up selection mode
        cleanupSelection(handleMouseOver, handleMouseOut, handleClick, handleResizeAndScroll);

        chrome.runtime.sendMessage({ type: 'elementSelected', elementType });
        console.log('Element selected:', elementType, target.getBoundingClientRect());
    };

    const handleResizeAndScroll = debounce(() => {
        console.log("handleResizeAndScroll", permanentHighlighters);
        Object.keys(permanentHighlighters).forEach((elementType) => {
            if (permanentHighlighters[elementType]) {
                updateHighlighterPosition(permanentHighlighters[elementType]);
            }
        });
    }, 100);

    // Use capturing phase for events
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    window.addEventListener('resize', handleResizeAndScroll, false);
    document.addEventListener('scroll', handleResizeAndScroll, false);
}

function cleanupSelection(mouseOverHandler, mouseOutHandler, clickHandler, resizeAndScrollHandler) {
    if (mouseOverHandler) {
        document.removeEventListener('mouseover', mouseOverHandler, true);
    }
    if (mouseOutHandler) {
        document.removeEventListener('mouseout', mouseOutHandler, true);
    }
    if (clickHandler) {
        document.removeEventListener('click', clickHandler, true);
    }

    if (resizeAndScrollHandler) {
        window.removeEventListener('resize', resizeAndScrollHandler, true);
        document.removeEventListener('scroll', resizeAndScrollHandler, true);
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