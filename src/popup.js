import './styles/index.scss';

document.addEventListener('DOMContentLoaded', () => {
    const partnerLangSelect = document.getElementById('partner-lang');
    const myLangSelect = document.getElementById('my-lang');
    const partnerText = document.getElementById('partner-text');
    const translatedPartnerText = document.getElementById('translated-partner-text');
    const myText = document.getElementById('my-text');
    const myTranslatedText = document.getElementById('my-translated-text');
    const sendButton = document.getElementById('send-btn');

    // Function to handle translation API call
    async function translateText(text, fromLang, toLang) {
        // Call to translation API would go here.
        // This is a placeholder implementation.
        return `[Translated: ${text}]`;
    }

    // Function to update the partner text and perform translation
    function updatePartnerText(newText) {
        partnerText.value = newText;

        // Translate partner's text
        translateText(newText, partnerLangSelect.value, myLangSelect.value)
            .then(translated => {
                translatedPartnerText.value = translated;
            });
    }

    // When user inputs their text, translate it
    myText.addEventListener('input', () => {
        translateText(myText.value, myLangSelect.value, partnerLangSelect.value)
            .then(translated => {
                myTranslatedText.value = translated;
            });
    });

    // Send button logic
    sendButton.addEventListener('click', () => {
        const finalText = myTranslatedText.value;

        // Send the final text to the content script to inject into the chat
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: injectTextIntoChat,
                args: [finalText]
            });
        });
    });

    // Listen for messages from the content script (chat detection)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'CHAT_MESSAGE_DETECTED') {
            updatePartnerText(message.text);
        }
    });

    document.addEventListener('click', handleOutsideClick);
});

// Function to inject the translated text into the chat (runs in the context of the webpage)
function injectTextIntoChat(finalText) {
    // You would need to modify this logic based on how the chat input works for a particular website.
    const chatInput = document.querySelector('input[type="text"], textarea');
    if (chatInput) {
        chatInput.value = finalText;
        const event = new Event('input', { bubbles: true });
        chatInput.dispatchEvent(event);  // Trigger chat app to recognize input
    }
}

function handleOutsideClick(event) {
    const popupContainer = document.getElementById('popup-container');

    if (popupContainer && !popupContainer.contains(event.target)) {
        window.close();
    }
}
