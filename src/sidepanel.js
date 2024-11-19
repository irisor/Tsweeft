import { getAllLanguages, getDisplayName, getTargetLanguages } from "./utils/languagePairUtils";
import { TranslationService } from "./services/translation.service";
import { debounce } from "./utils/timing";
import { handleUserMessage } from "./utils/userMessageUtil";
import './styles/index.scss';

const PORT_NAME = 'TsweeftConnection';
const SidePanel = {
    elements: null,
    state: null,

    getElements() {
        return {
            loadingOverlay: document.getElementById('loading-overlay'),
            chatDetectionMessage: document.getElementById('chat-detection-message'),
            manualSelectionBtn: document.getElementById('manual-selection-btn'),
            selectChatArea: document.getElementById('select-chat-area'),
            selectInputArea: document.getElementById('select-input-area'),
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

    initManualSelectionUI() {
        this.elements.selectChatArea.addEventListener('click', () => this.startElementSelection('chatArea'));
        this.elements.selectInputArea.addEventListener('click', () => this.startElementSelection('inputArea'));
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
            },
            selectedElements: {
                chatArea: false,
                inputArea: false
            },
            port: null
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

    startElementSelection(elementType) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            this.sendMessage({
                type: 'startElementSelection',
                elementType: elementType
            });
        });
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
            this.sendMessage({
                type: 'sidePanelOpened',
                tabId: this.state.tabId
            });
        } catch (error) {
            console.log('Error in sending sidePanelOpened:', error);
            handleUserMessage('Failed to initialize content script', 'error');
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
            const partnerLang = this.elements.partnerLangSelect.value;
            const myLang = this.elements.myLangSelect.value;
            const partnerLangDisplayName = this.elements.partnerLangSelect?.selectedOptions[0]?.textContent;
            const myLangDisplayName = this.elements.myLangSelect?.selectedOptions[0]?.textContent;

            if (!partnerLang || !myLang) {
                throw new Error('Select a language pair');
            }

            this.state.selectedLanguages = {
                partner: {
                    code: partnerLang,
                    displayName: partnerLangDisplayName
                },
                my: {
                    code: myLang,
                    displayName: myLangDisplayName
                }
            };

            await TranslationService.initTranslation(this.state.selectedLanguages);
            await chrome.storage.local.set({ selectedLanguages: this.state.selectedLanguages });

            this.updatePartnerText(this.elements.partnerText.value);

            handleUserMessage(
                `Language pair updated to ${partnerLangDisplayName} to ${myLangDisplayName}`,
                'success'
            );
        } catch (error) {
            handleUserMessage('Error updating languages', 'error');
            console.error('Error updating languages:', error);
            return;
        } finally {
            this.elements.loadingOverlay.classList.add('hidden');
            this.disableInputs(false);
        }

        try {
            const translated = await TranslationService.translateText(this.elements.myText.value, false);
            this.elements.myTranslatedText.value = translated;
        } catch (error) {
            console.log('Error translating text:', error);
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
        // Disconnect any existing port
        if (this.state.port) {
            this.state.port.disconnect();
        }

        // Create a long-lived connection
        this.state.port = chrome.tabs.connect(this.state.tabId, { name: PORT_NAME });

        // Set up port message listener
        this.state.port.onMessage.addListener((message) => {
            console.log('Sidepanel received message:', message);
            this.handlePortMessage(message);
        });

        // Handle port disconnection
        this.state.port.onDisconnect.addListener(() => {
            console.log('Port disconnected');
            this.cleanup();
        });

        console.log('Side panel port connection established');
    },

    handlePortMessage(message) {
        switch (message.type) {

            case 'elementSelected':
                console.log('Sidepanel Element selected:', message.elementType, this.elements.chatDetectionMessage);
                this.state.selectedElements[message.elementType] = true;

                if (message.elementType === 'chatArea' && this.elements.chatDetectionMessage) {
                    this.elements.chatDetectionMessage.classList.add('hidden');
                }

                if (this.state.selectedElements['chatArea'] && this.state.selectedElements['inputArea']) {
                    console.log('myText element:', this.elements.myText);
                    console.log('myText tabIndex:', this.elements.myText.tabIndex);
                    this.elements.myText.focus();
                    this.elements.myText.scrollIntoView();
                }
                break;

            case 'chatMessageDetected':
                console.log('Received chat message:', message.text.substring(0, 50) + '...');
                this.updatePartnerText(message.text);
                this.sendMessage({ type: 'chatMessageAck', success: true });
                break;

            case 'closeSidePanel':
                console.log('Closing side panel');
                this.cleanup();
                window.close();
                break;
        }
    },

    // Method to send messages through the port
    sendMessage(message) {
        if (!this.state.port) {
            console.error('Port connection not established');
            this.setupMessageListeners();
        }
        if (this.state.port) {
            this.state.port.postMessage(message);
        }
    },

    setupEventListeners() {
        console.log('Sidepanel setting up event listeners ***', this.state.tabId);

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
                this.sendMessage({
                    type: 'injectTextIntoChat',
                    text: finalTranslatedText
                });
            }
        }, 500);
    },

    cleanup() {
        console.log('Cleaning up port connection');

        // Disconnect port if it exists
        if (this.state.port) {
            try {
                this.state.port.disconnect();
            } catch (error) {
                console.error('Error disconnecting port:', error);
            }
            this.state.port = null;
        }

        // Remove event listeners
        this.elements.myText.removeEventListener('input', this.inputListener);
        this.elements.sendButton.removeEventListener('click', this.sendButtonListener);
        this.elements.myText.removeEventListener('keydown', this.keydownListener);
        this.elements.myLangSelect.removeEventListener('change', this.langSelectListener);
        this.elements.setLangsBtn.removeEventListener('click', this.setLangsBtnListener);
    },

    async init() {
        console.log('Sidepanel Initializing...');
        this.elements = this.getElements();
        console.log('Sidepanel Elements:', this.elements);
        this.state = this.initState();
        console.log('Sidepanel State:', this.state);
        this.initManualSelectionUI();
        console.log('Sidepanel Manual selection UI initialized');
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
    console.log('SidePanel loaded');
    SidePanel.init();
});
