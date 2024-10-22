import './styles/index.scss';
import { getAllLanguages, getDisplayName, getTargetLanguages } from './utils/languagePairUtils';
import { handleMessage } from './utils/messageUtil';
import { debounce } from './utils/timing';

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
    const browserLanguage = navigator.language.split('-')[0];
    let selectedLanguages = {
        partner: {
            code: 'es',
            displayName: 'Spanish'
        },
        my: {
            code: browserLanguage,
            displayName: getDisplayName(browserLanguage) || browserLanguage
        }
    };

    (async function init() {
        await initLanguages();
        try {
            await initTranslation();
        } catch (error) {
            handleMessage('Failed to setup translation', 'error');
            console.log('Failed to setup translation', error);
        }
    })();

    async function initTranslation() {
        let myToPartner, partnerToMy;
        try {
            myToPartner = await setupTranslation(selectedLanguages.my.code, selectedLanguages.partner.code);
            if (myToPartner) partnerToMy = await setupTranslation(selectedLanguages.partner.code, selectedLanguages.my.code);
            myToPartnerTranslator = myToPartner;
            partnerToMyTranslator = partnerToMy;
        } catch (error) {
            return Promise.reject(error);
        }
    };

    async function setupTranslation(fromLang, toLang) {
        const languagePair = {
            sourceLanguage: fromLang,
            targetLanguage: toLang,
        };

        const canTranslate = await translation.canTranslate(languagePair);
        if (canTranslate !== 'no') {
            if (canTranslate === 'readily') {
                return await translation.createTranslator(languagePair);
            } else {
                handleMessage('Translation needs to be downloaded', 'warning');
                console.log('Translation needs to be downloaded', canTranslate);
                const translator = await translation.createTranslator(languagePair);
                translator.addEventListener('downloadprogress', (e) => {
                    console.log(e.loaded, e.total);
                });
                await translator.ready;
                return translator;
            }
        } else {
            handleMessage('No translation available for this language pair', 'error');
            console.log('No translation available');
            return null
        }
    };

    async function initLanguages() {
        const result = await new Promise(resolve => {
            chrome.storage.local.get('selectedLanguages', resolve);
        });

        if (result.selectedLanguages) {
            selectedLanguages = result.selectedLanguages;
        }

        handleMyLangChange(selectedLanguages.my.code);
        partnerLangSelect.value = selectedLanguages.partner.code;
        myLangSelect.value = selectedLanguages.my.code;
    }

    async function translateText(text, translator) {
        if (!translator) {
            return '';
        }
        const translatedText = await translator.translate(text);
        //   const readableStreamOfText = await translator.translateStreaming(`
        //     Four score and seven years ago our fathers brought forth, upon this...
        //   `);
        return translatedText;
    }

    // Update partner text and translated partner text
    function updatePartnerText(newText) {
        partnerText.value = newText;

        debounce(() => {
            translateText(newText, selectedLanguages.partner.code, selectedLanguages.my.code)
                .then(translated => {
                    translatedPartnerText.value = translated;
                });
        }, 500)();
    }

    // Translate my text
    myText.addEventListener('input', debounce(() => {
        translateText(myText.value, myToPartnerTranslator)
            .then(translated => {
                myTranslatedText.value = translated;
            });
    }, 500));

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
            partner: { code: partnerLangSelect.value, displayName: partnerLangSelect?.selectedOptions[0]?.textContent },
            my: { code: myLangSelect.value, displayName: myLangSelect?.selectedOptions[0]?.textContent }
        };
        initTranslation();
        await chrome.storage.local.set({ selectedLanguages });
        handleMessage(`Language pair updated to ${selectedLanguages.partner.displayName} to ${selectedLanguages.my.displayName}`, 'success');
        const event = new Event('input');
        myText.dispatchEvent(event);

    });
});

// Function to inject the translated text into the chat (runs in the context of the webpage)
function injectTextIntoChat(finalText) {
    // You would need to modify this logic based on how the chat input works for a particular website.
    const chatInput = document.querySelector('input[type="text"], textarea');
    if (chatInput) {
        chatInput.value = finalText;
        const event = new Event('input', { bubbles: true });
        chatInput.dispatchEvent(event); // Trigger chat app to recognize input
    }
}
