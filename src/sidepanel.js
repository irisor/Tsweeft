import './styles/index.scss';
import { getAllLanguages, getDisplayName, getTargetLanguages } from './utils/languagePairUtils';
import { handleMessage } from './utils/messageUtil';
import { debounce } from './utils/timing';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Side panel loaded.');
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

    // Listen for messages from the content script (chat detection)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('sidePanel onMessage', message, sender, sendResponse);
        if (message.type === 'chatMessageDetected') {
            updatePartnerText(message.text);
        }
    });

    console.log('sidePanel before sendMessage sidePanelOpened');
    // Send a message to the background script to activate the content script

    chrome.runtime.sendMessage({ type: 'sidePanelOpened' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error in sending sidePanelOpened:', chrome.runtime.lastError.message);
        } else if (response?.success) {
            console.log('Side panel opened successfully.');
        } else {
            console.warn('No response received for sidePanelOpened message.');
        }
    });

    (async function init() {
        console.log('Initializing...');
        initDisplay();
        await initLanguages();
        try {
            await initTranslation();
        } catch (error) {
            handleMessage('Failed to setup translation', 'error');
            console.log('Failed to setup translation', error);
        }
    })();

    function initDisplay() {
        myText.value = '';
        myTranslatedText.value = '';
        partnerText.value = '';
        translatedPartnerText.value = '';
    }

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
            translateText(newText, partnerToMyTranslator)
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
    sendButton?.addEventListener('click', async () => {
        const originalText = document.getElementById('my-text')?.value || '';
        const translatedText = document.getElementById('my-translated-text')?.value || '';

        // Send message to content.js to inject text into chat
        await chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'injectTextIntoChat', originalText, translatedText }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error injecting text into chat:', chrome.runtime.lastError.message);
                    } else {
                        console.log('Text injected into chat:', response);
                    }
                });
            } else {
                console.error('No active tab found to inject text.');
            }
        });
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

        partnerLangSelect.value = ''; // Clear existing options

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
