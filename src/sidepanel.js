import { getAllLanguages, getDisplayName, getTargetLanguages } from "./utils/languagePairUtils";
import { TranslationService } from "./services/translation.service";
import { debounce } from "./utils/timing";
import { handleMessage } from "./utils/messageUtil";

const SidePanel = {
    elements: null,
    state: null,

    getElements() {
        return {
            loadingOverlay: document.getElementById('loading-overlay'),
            partnerLangSelect: document.getElementById('partner-lang'),
            myLangSelect: document.getElementById('my-lang'),
            setLangsBtn: document.getElementById('set-langs-btn'),
            partnerText: document.getElementById('partner-text'),
            translatedPartnerText: document.getElementById('translated-partner-text'),
            myText: document.getElementById('my-text'),
            myTranslatedText: document.getElementById('my-translated-text'),
            sendButton: document.getElementById('send-btn')
        };
    },

    initState() {
        const browserLanguage = navigator.language.split('-')[0];
        return {
            history: [],
            historyString: '',
            tabId: null,
            selectedLanguages: {
                partner: {
                    code: 'es',
                    displayName: 'Spanish'
                },
                my: {
                    code: browserLanguage,
                    displayName: getDisplayName(browserLanguage) || browserLanguage
                }
            }
        };
    },

    initDisplay() {
        this.elements.myText.value = '';
        this.elements.myTranslatedText.value = '';
        this.elements.partnerText.value = '';
        this.elements.translatedPartnerText.value = '';
    },

    initHistory() {
        this.state.history = [];
        this.state.historyString = '';
    },

    async initializeTab() {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
            console.error('No active tab found.');
            return;
        }

        this.state.tabId = tabs[0].id;
        console.log('Sidepanel tab initialized with Tab ID:', this.state.tabId);

        // Set up message listeners before sending initialization message
        this.setupMessageListeners();

        try {
            const response = await chrome.tabs.sendMessage(this.state.tabId, {
                type: 'sidePanelOpened',
                tabId: this.state.tabId
            });

            console.log('sidePanelOpened response:', response);
            if (!response || !response.success) {
                console.error('Failed to initialize content script');
                handleMessage('Failed to initialize content script', 'error');
            }
        } catch (error) {
            console.error('Error in sending sidePanelOpened:', error);
            handleMessage('Failed to initialize content script', 'error');
        }
    },

    async initLanguages() {
        const result = await chrome.storage.local.get('selectedLanguages');
        if (result.selectedLanguages) {
            this.state.selectedLanguages = result.selectedLanguages;
        }

        this.handleMyLangChange(this.state.selectedLanguages.my.code);
        this.elements.partnerLangSelect.value = this.state.selectedLanguages.partner.code;
        this.elements.myLangSelect.value = this.state.selectedLanguages.my.code;
    },

    handleMyLangChange(value) {
        this.elements.partnerLangSelect.value = '';
        this.elements.partnerLangSelect.innerHTML = '';
        getTargetLanguages(value).forEach(lang => {
            const option = new Option(lang.displayName, lang.code);
            this.elements.partnerLangSelect.add(option);
        });
    },

    updatePartnerText(text) {
        const newText = text.replace(this.state.historyString, '');
        this.elements.partnerText.value = newText;

        debounce(async () => {
            const translated = await TranslationService.translateText(newText, true);
            this.elements.translatedPartnerText.value = translated;
        }, 500)();
    },

    async handleLanguageUpdate() {
        this.elements.loadingOverlay.classList.remove('hidden');
        this.disableInputs(true);

        try {
            this.state.selectedLanguages = {
                partner: {
                    code: this.elements.partnerLangSelect.value,
                    displayName: this.elements.partnerLangSelect?.selectedOptions[0]?.textContent
                },
                my: {
                    code: this.elements.myLangSelect.value,
                    displayName: this.elements.myLangSelect?.selectedOptions[0]?.textContent
                }
            };

            await TranslationService.initTranslation(this.state.selectedLanguages);
            await chrome.storage.local.set({ selectedLanguages: this.state.selectedLanguages });

            this.updatePartnerText(this.elements.partnerText.value);
            const translated = await TranslationService.translateText(this.elements.myText.value, false);
            this.elements.myTranslatedText.value = translated;

            handleMessage(
                `Language pair updated to ${this.state.selectedLanguages.partner.displayName} to ${this.state.selectedLanguages.my.displayName}`,
                'success'
            );
        } catch (error) {
            handleMessage('Error updating languages', 'error');
            console.error('Error updating languages:', error);
        } finally {
            this.elements.loadingOverlay.classList.add('hidden');
            this.disableInputs(false);
        }
    },

    disableInputs(disabled) {
        Object.values(this.elements).forEach(element => {
            if (element && typeof element.disabled !== 'undefined') {
                element.disabled = disabled;
            }
        });
    },

    setupMessageListeners() {
        // Remove any existing listeners first
        if (chrome.runtime.onMessage.hasListeners()) {
            chrome.runtime.onMessage.removeListener(this.messageHandler);
        }

        // Bind the message handler to preserve 'this' context
        this.messageHandler = this.handleRuntimeMessage.bind(this);
        chrome.runtime.onMessage.addListener(this.messageHandler);

        console.log('Side panel message listeners initialized');
    },

    handleRuntimeMessage(message, sender, sendResponse) {
        console.log('Sidepanel received message:', message);

        switch (message.type) {
            case 'contentScriptReady':
                console.log('Content script ready confirmation received');
                sendResponse({ success: true });
                break;

            case 'chatMessageDetected':
                console.log('Received chat message:', message.text.substring(0, 50) + '...');
                this.updatePartnerText(message.text);
                sendResponse({ success: true });
                break;

            case 'closeSidePanel':
                console.log('Closing side panel');
                window.close();
                break;
        }

        return true; // Keep channel open for async response
    },

    setupEventListeners() {
        // UI event listeners
        window.addEventListener('beforeunload', async () => {
            console.log('Sidepanel Sending sidePanelClosed message to tab:', this.state.tabId);
            if (this.state.tabId) {
                try {
                    await chrome.tabs.sendMessage(this.state.tabId, {
                        type: 'sidePanelClosed'
                    });
                    console.log('Successfully sent sidePanelClosed message');
                } catch (error) {
                    console.error('Error sending sidePanelClosed:', error);
                }
            }
        });

        this.elements.myText.addEventListener('input', debounce(async () => {
            console.log('Sidepanel Translating my text:', this.elements.myText.value);
            const translated = await TranslationService.translateText(this.elements.myText.value, false);
            console.log('Sidepanel Translated my text:', translated);
            this.elements.myTranslatedText.value = translated;
        }, 500));

        this.elements.sendButton?.addEventListener('click', () => {
            console.log('Sending message');
            this.handleSend();
        });

        this.elements.myText.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.elements.sendButton.click();
            }
        });

        this.elements.myLangSelect.addEventListener('change', (event) => {
            console.log('Sidepanel My language changed to:', event.target.value);
            this.handleMyLangChange(event.target.value);
        });

        this.elements.setLangsBtn.addEventListener('click', () => {
            console.log('Sidepanel Updating languages');
            this.handleLanguageUpdate();
        });

        // Populate source language select
        getAllLanguages().forEach(lang => {
            const option = new Option(lang.displayName, lang.code);
            this.elements.myLangSelect.add(option);
        });
    },

    async handleSend() {
        console.log('Sidepanel Sending message to content script');
        const myTextValue = this.elements.myText.value;
        const translatedMyText = this.elements.myTranslatedText.value;
        const partnerTextValue = this.elements.partnerText.value;
        const translatedPartnerText = this.elements.translatedPartnerText.value;

        // Save to history
        this.state.history.push({
            partnerText: partnerTextValue,
            translatedPartnerText: translatedPartnerText,
            myText: myTextValue,
            translatedMyText: translatedMyText
        });

        this.state.historyString += partnerTextValue + '\n' + translatedMyText;

        // Send message to content script
        setTimeout(() => {
            console.log('Sidepanel Injecting text into chat:', this.elements.myTranslatedText.value);
            const finalTranslatedText = this.elements.myTranslatedText.value;
            if (finalTranslatedText) {
                chrome.tabs.sendMessage(this.state.tabId, {
                    type: 'injectTextIntoChat',
                    text: finalTranslatedText
                }).then(() => {
                    console.log('Text injected successfully');
                    this.initDisplay();
                }).catch(error => {
                    console.error('Error injecting text into chat:', error);
                });
            }
        }, 500);
    },

    async init() {
        console.log('Sidepanel Initializing...');
        this.elements = this.getElements();
        console.log('Sidepanel Elements:', this.elements);
        this.state = this.initState();
        console.log('Sidepanel State:', this.state);
        this.initDisplay();
        console.log('Sidepanel Display initialized');
        this.initHistory();
        console.log('Sidepanel History initialized');

        // Initialize tab and message listeners first
        await this.initializeTab();
        console.log('Sidepanel Tab initialized');

        // Then initialize the rest
        await this.initLanguages();
        console.log('Sidepanel Languages initialized');
        await TranslationService.initTranslation(this.state.selectedLanguages);
        console.log('Sidepanel Translation initialized');
        this.setupEventListeners();
        console.log('Sidepanel initialization complete');
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    SidePanel.init();
});
