import './styles/index.scss';
import { getAllLanguages, getTargetLanguages } from './utils/language-pair-utils';

document.addEventListener('DOMContentLoaded', () => {
    const partnerLangSelect = document.getElementById('partner-lang');
    const myLangSelect = document.getElementById('my-lang');
    const setLangsBtn = document.getElementById('set-langs-btn');
    const partnerText = document.getElementById('partner-text');
    const translatedPartnerText = document.getElementById('translated-partner-text');
    const myText = document.getElementById('my-text');
    const myTranslatedText = document.getElementById('my-translated-text');
    const sendButton = document.getElementById('send-btn');
    let myToPartnerTranslator = null;
    let partnerToMyTranslator = null;
    let selectedLanguages = {
        partner: {
            code: 'es',
            displayName: 'Spanish'
        },
        my: {
            code: 'en',
            displayName: 'English'
        }
    };

    (function init() {
        initLanguages();
        initTranslation();
    })();

    document.addEventListener('click', handleOutsideClick);

    async function initTranslation() {

        const languagePair = {
            sourceLanguage: 'en', // Or detect the source language with the Language Detection API
            targetLanguage: 'es',
        };

        const canTranslate = await translation.canTranslate(languagePair);
        if (canTranslate !== 'no') {
            if (canTranslate === 'readily') {
                // The translator can immediately be used.
                myToPartnerTranslator = await translation.createTranslator(languagePair);
            } else {
                // The translator can be used after the model download.
                console.log('Translation needs to be downloaded', canTranslate);
                myToPartnerTranslator = await translation.createTranslator(languagePair);
                myToPartnerTranslator.addEventListener('downloadprogress', (e) => {
                    console.log(e.loaded, e.total);
                });
                await myToPartnerTranslator.ready;
            }
        } else {
            console.log('No translation available');
            // The translator can't be used at all.
        }
    };

    async function initLanguages() {
        chrome.storage.local.get('selectedLanguages', (result) => {
            const storedLanguages = result.selectedLanguages;
            if (storedLanguages) {
                selectedLanguages = storedLanguages;
            }
            if (selectedLanguages) {
                handleMyLangChange(selectedLanguages.my.code);
                setTimeout(() => partnerLangSelect.value = selectedLanguages.partner.code, 200);
                setTimeout(() => myLangSelect.value = selectedLanguages.my.code, 200);
                // myLangSelect.value = selectedLanguages.my.code;
                // myLangSelect.value = 'de';
            }
        });
    };

    // Function to handle translation API call
    async function translateText(text, fromLang, toLang) {


        const translatedText = await myToPartnerTranslator.translate(text);
        //   const readableStreamOfText = await translator.translateStreaming(`
        //     Four score and seven years ago our fathers brought forth, upon this...
        //   `);
        return translatedText;
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

    // Send translation
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

    // Populate the source language select
    getAllLanguages().forEach(lang => {
        const option = new Option(lang.displayName, lang.code);
        myLangSelect.add(option);
    });

    // Update the target language select when source language changes
    myLangSelect.addEventListener('change', (event) => {
        handleMyLangChange(event.target.value);
    });

    function handleMyLangChange(value) {
        const selectedSourceLang = value;
       
        partnerLangSelect.innerText = ''; // Clear existing options

        getTargetLanguages(selectedSourceLang).forEach(lang => {
            const option = new Option(lang.displayName, lang.code);
            partnerLangSelect.add(option);
        });
    };

    // Change languages after languages update

    setLangsBtn.addEventListener('click', async () => {
        selectedLanguages = {
            selectedLanguages: {
                partner: { code: partnerLangSelect.value, displayName: partnerLangSelect?.selectedOptions[0]?.textContent },
                my: { code: myLangSelect.value, displayName: myLangSelect?.selectedOptions[0]?.textContent }
            }
        };
        await chrome.storage.local.set(selectedLanguages);
    });
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
