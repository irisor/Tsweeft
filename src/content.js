console.log('Content script loaded');
const chatUtils = {
    outputMessages: document.querySelectorAll('.chatbot-input'),

    detectChatMessages: function () {

        const inputMessages = document.querySelectorAll('.chatbot-messages');

        const lastMessageMap = {};
        inputMessages.forEach((messageElement) => {
            const messageText = messageElement.innerText;

            if (!lastMessageMap[messageElement]) {
                lastMessageMap[messageElement] = '';
            }
            const newText = messageText.replace(lastMessageMap[messageElement], '');
            lastMessageMap[messageElement] = messageText;
            if (newText) {
                chrome.runtime.sendMessage({
                    type: 'CHAT_MESSAGE_DETECTED',
                    text: newText
                });
            }
        });
    },

    injectTextIntoChat: function (finalText) {
        const targetElement = chatUtils.outputMessages[0];
        if (targetElement) {
            targetElement.value = finalText;
            const event = new Event('input', { bubbles: true });
            targetElement.dispatchEvent(event); // Trigger chat app to recognize input
        }
    }
};

// Expose chatUtils functions to popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    if (request.action === 'detectChatMessages') {
        chatUtils.detectChatMessages();
    } else if (request.action === 'injectTextIntoChat') {
        chatUtils.injectTextIntoChat(request.finalText);
    }
});

