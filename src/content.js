import { Logger } from "./utils/logger";

Logger.info('Content script loaded');
let isSidepanelOpen = false;
let chatObserver = null;
let isObservingChat = false;
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
let connectionPort = null;
let highlighters = [];
let highlightersObserver = null;
const PORT_NAME = 'TsweeftConnection';
const connectListener = (port) => onConnectListener(port);
const portMessageListener = (message) => onPortMessageListener(message);
const cleanupController = new AbortController();
const { signal: cleanupSignal } = cleanupController;


setupEventListeners();

// Cleanup function to handle observer disconnection
function cleanup() {
    if (!isSidepanelOpen) return;

    isSidepanelOpen = false;
    lastChatLength = 0;
    lastChatMyMessage = '';
    chatArea = null;
    inputArea = null;
    isSelectionMode = false;

    if (overlay) {
        overlay.remove();
        overlay = null;
    }

    // Cleanup permanent highlighter variables and html classes
    try {
        removeHighlighters();
    } catch (error) {
        Logger.warn('Error removing highlighters:', error);
    }

    try {
        Object.keys(permanentHighlighters).forEach((key) => {
            if (!permanentHighlighters[key]) return;
            permanentHighlighters[key].remove();
            permanentHighlighters[key] = null;
        });
    } catch (error) {
        Logger.warn('Error cleaning up permanent highlighters:', error);
    }

    try {
        cleanupChatObserver();
    } catch (error) {
        Logger.warn('Error cleaning up observer:', error);
    }

    try {
        cleanupPort();
    } catch (error) {
        Logger.warn('Error cleaning up port:', error);
    }
}

function cleanupPort() {
    if (connectionPort) {
        try {
            connectionPort.onMessage.removeListener(portMessageListener);
            connectionPort.disconnect();
        } catch (error) {
            Logger.warn('Error cleaning up port:', error);
        } finally {
            connectionPort = null;
        }
    }
}

function cleanupChatObserver() {
    if (chatObserver && isObservingChat) {
        Logger.debug('Cleaning up observer');
        chatObserver.disconnect();
        chatObserver = null;
        isObservingChat = false;
    }
}

function setupEventListeners() {
    chrome.runtime.onConnect.addListener(connectListener);
    window.addEventListener('beforeunload', onBeforeunload, { signal: cleanupSignal });
}

function onConnectListener(port) {
    if (port.name !== PORT_NAME) return

    // Disconnect any existing port
    if (connectionPort) {
        connectionPort.disconnect();
    }
    connectionPort = port;

    // Listen for messages
    port.onMessage.addListener(portMessageListener);

    port.onDisconnect.addListener(() => {
        Logger.debug('Port disconnected');
        document.dispatchEvent(new CustomEvent('sidePanelClosed', { detail: {} }));
        cleanup();
        cleanupController.abort();
    });
}

function onPortMessageListener(message) {
    Logger.debug('Content onMessage', message);

    switch (message.type) {

        case "startElementSelection":
            startElementSelection(message.elementType);
            break;

        case "sidePanelOpened":
            initElementSelectionUI();
            cleanup();
            isSidepanelOpen = true;
            trackHighlighters();
            Logger.info('Activating observer on this tab.');
            break;

        case "injectTextIntoChat":
            injectTextIntoChat(message.text);
            break;

        default:
            Logger.warn('Unrecognized message type:', message.type);
            break;
    }
}

function onBeforeunload() {
    try {
        sendPortMessage({ type: 'closeSidePanel' });
    } catch (error) {
        Logger.warn('Content attempted to close side panel, but failed:', error);
    }
    cleanup();
    cleanupController.abort();
}

function chatObserverElement(targetElement) {
    if (!targetElement) {
        Logger.info('Messages to translate not found');
        return;
    }

    sendChatToSidepanel(targetElement.innerText);

    // Observer setup
    if (targetElement) {
        chatObserver = new MutationObserver(debounce((mutations) => {
            if (mutations.some(m => m.type === 'childList' || m.type === 'characterData')) {
                sendChatToSidepanel(targetElement.innerText);
            }
        }, 500));

        chatObserver.observe(targetElement, { childList: true, subtree: true });
        isObservingChat = true;
        Logger.debug('Chat Observer initialized for inputMessage.');
    } else {
        Logger.info('No input message found to observe.');
    }
}

function sendChatToSidepanel(text) {
    if (!text) return;

    // Remove previous chat text from the text sent to the sidepanel, so that only new text wioll be displayed in the sidepanel
    let newText = text.substring(lastChatLength);
    if (newText) newText = removeStartString(newText, lastChatMyMessage); // Remove my last message

    sendPortMessage({
        type: 'chatMessageDetected',
        text: newText
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
    Logger.debug('Chat elements detected:', chatElements);

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
    Logger.debug('detectChat');

    return null;
}

function trackHighlighters() {
    // Track changes in the highlighters reference elements, to recalculate the highlighter position and size
    const debouncedObserverCallback = debounce((mutations) => {
        mutations.forEach((mutation) => {
            const highlighter = highlighters.find((highlighter) => highlighter.referenceElement === mutation.target);
            if (highlighter) {
                updateHighlighterPosition(highlighter);
            }
        });
    }, 500);
    highlightersObserver = new MutationObserver(debouncedObserverCallback);
}

function createHighlighter(className, referenceElement = null) {
    const highlighter = document.createElement('div');
    highlighter.className = `element-highlighter ${className}`;
    if (referenceElement) {
        highlighter.referenceElement = referenceElement;
        highlighters.push(highlighter);
        highlightersObserver.observe(highlighter.referenceElement, {
            childList: true,
            subtree: true,
        });
    }
    document.body.appendChild(highlighter);
    return highlighter;
}

function removeHighlighters() {
    const highlighters = document.querySelectorAll('.element-highlighter');
    if (highlightersObserver) highlightersObserver.disconnect();

    for (const highlighter of highlighters) {
        highlighter.remove();
    }
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
    const cleanupSelectionController = new AbortController();
    const { signal: cleanupSelectionSignal } = cleanupSelectionController;

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
            highlightersObserver.disconnect(permanentHighlighters[elementType].referenceElement);
        }

        // Create new permanent highlighter
        permanentHighlighters[elementType] = createHighlighter(`permanent-highlighter ${elementType}-highlighter`, target);
        updateHighlighterPosition(permanentHighlighters[elementType]);

        // Update stored element reference
        if (elementType === 'chatArea') {
            chatArea = target;
            cleanupChatObserver();
            chatObserverElement(chatArea);
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
        cleanupSelection(cleanupSelectionController, handleMouseOver, handleMouseOut, handleClick, handleResizeAndScroll);

        sendPortMessage({ type: 'elementSelected', elementType });
    };

    const handleResizeAndScroll = debounce(() => {
        Object.keys(permanentHighlighters).forEach((elementType) => {
            if (permanentHighlighters[elementType]) {
                updateHighlighterPosition(permanentHighlighters[elementType]);
            }
        });
    }, 100);

    // Use capturing phase for events
    document.addEventListener('mouseover', handleMouseOver, { capture: true, signal: cleanupSelectionSignal });
    document.addEventListener('mouseout', handleMouseOut, { capture: true, signal: cleanupSelectionSignal });
    document.addEventListener('click', handleClick, { capture: true, signal: cleanupSelectionSignal });

    // These events are used to update the highlighter position
    // They use the cleanupSignal and not the cleanupSelectionSignal because they should'nt be cleaned up
    // when the selection mode is closed
    window.addEventListener('resize', handleResizeAndScroll, { passive: true, signal: cleanupSignal });
    document.addEventListener('scroll', handleResizeAndScroll, { passive: true, signal: cleanupSignal });

    window.addEventListener('beforeunload', () => {
        cleanupSelection(cleanupSelectionController, handleMouseOver, handleMouseOut, handleClick, handleResizeAndScroll);
    }, { once: true, signal: cleanupSelectionSignal });

    document.addEventListener('sidePanelClosed', () => {
        Logger.debug('StartElementSelection Sidepanel closed');
        cleanupSelection(cleanupSelectionController, handleMouseOver, handleMouseOut, handleClick, handleResizeAndScroll);
    }, { once: true, signal: cleanupSelectionSignal });


    function cleanupSelection(cleanupSelectionController, mouseOverHandler, mouseOutHandler, clickHandler, resizeAndScrollHandler) {
        cleanupSelectionController.abort();

        if (activeHighlighter) {
            activeHighlighter.remove();
            activeHighlighter = null;
        }

        isSelectionMode = false;
        if (overlay) {
            overlay.style.pointerEvents = 'auto';
        }
    }
}

// Send messages through the port
function sendPortMessage(message) {
    if (!connectionPort) {
        Logger.info('Port connection not established');
        setupEventListeners();
    }
    if (connectionPort) {
        connectionPort.postMessage(message);
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