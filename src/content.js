console.log('Content script loaded');
const inputMessage = document.querySelector('.chatbot-messages');
const outputMessage = document.querySelector('.chatbot-input');

observerElement(inputMessage);
const chatUtils = {

    injectTextIntoChat: function (originalText, translatedText) {
        const targetElement = outputMessage;
        if (targetElement) {
            targetElement.value = translatedText;
            const event = new Event('input', { bubbles: true });
            targetElement.dispatchEvent(event); // Trigger chat app to recognize input
        }

        // Store the original text in the lastMessageMap object and in session storage
        let lastMessage = JSON.parse(sessionStorage.getItem('lastMessage')) || '';
        lastMessage = lastMessage + originalText;
        sessionStorage.setItem('lastMessage', JSON.stringify(lastMessage));
    }

};

// Expose chatUtils functions to sidepanel.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'injectTextIntoChat') {
        chatUtils.injectTextIntoChat(request.originalText, request.translatedText);
    }
});

function observerElement(targetElement) {
    console.log('observerElement', targetElement);

    if (!targetElement) {
        console.log('Messages to translate not found');
        return;
    }
    sendText(targetElement.innerText);

    // Create a MutationObserver instance
    const observer = new MutationObserver((mutations) => {
        console.log('observer', mutations);
        if (mutations.some(mutation => mutation.type === 'attributes' ||
            mutation.type === 'characterData' ||
            mutation.type === 'childList')) {
            const newText = targetElement.innerText;

            sendText(newText);
        }
    });

    // Configuration for the observer
    const config = {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true
    };

    // Start observing
    observer.observe(targetElement, config);

    function sendText(newText) {
        if (!newText) {
            return;
        }
        // Send message to background script
        console.log('Chatbot detected new message: %s', newText);
        chrome.runtime.sendMessage({
            type: 'CHAT_MESSAGE_DETECTED',
            text: newText
        });
    }
}
