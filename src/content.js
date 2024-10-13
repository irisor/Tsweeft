// Example strategy to detect chat messages in an iframe or DOM element
function detectChatMessages() {
    // Placeholder for actual chat message detection logic.
    // This could vary depending on the specific chatbot (e.g., mutation observers).
    
    const messages = document.querySelectorAll('.chat-message'); // Adjust selector as needed
    
    messages.forEach((messageElement) => {
        const messageText = messageElement.innerText;

        // Send detected message to popup
        chrome.runtime.sendMessage({
            type: 'CHAT_MESSAGE_DETECTED',
            text: messageText
        });
    });
}

// Use MutationObserver to detect dynamic changes in the chat
const chatContainer = document.querySelector('.chat-container');  // Adjust selector based on actual DOM structure

if (chatContainer) {
    const observer = new MutationObserver(detectChatMessages);
    observer.observe(chatContainer, { childList: true, subtree: true });
}
