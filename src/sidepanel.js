import { getAllLanguages, getDisplayName, getTargetLanguages } from "./utils/languagePairUtils";
import { TranslationService } from "./services/translation.service";
import { debounce } from "./utils/timing";
import { handleUserMessage } from "./utils/userMessageUtil";
import { Logger } from "./utils/logger";
import './styles/index.scss';

const PORT_NAME = 'TsweeftConnection';
const SidePanel = {
    elements: null,
    state: null,

    // Store references to the event listener functions
    listeners: {
        myTextInput: debounce(async () => {
            const translated = await TranslationService.translateText(SidePanel.elements.myText.value, false);
            SidePanel.elements.myTranslatedText.value = translated;
        }, 500),
    
        sendButton: () => {
            Logger.debug('Sending message');
            SidePanel.handleSend();
        },
    
        myTextKeyDown: (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                SidePanel.elements.sendButton.click();
            }
        },
    
        myLangSelectChange: (event) => {
            SidePanel.handleMyLangChange(event.target.value);
        },
    
        setLangsBtnClick: () => {
            SidePanel.handleLanguageUpdate();
        },

       selectChatArea: () => { SidePanel.startElementSelection('chatArea') },
       selectInputArea: () => { SidePanel.startElementSelection('inputArea') },
       partnerTextLocate: () => { SidePanel.startElementSelection('chatArea') },
       myTranslatedTextLocate: () => { SidePanel.startElementSelection('inputArea') },
    },

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
            partnerTextLocate: document.getElementById('partner-text-locate'),
            translatedPartnerText: document.getElementById('translated-partner-text'),
            myText: document.getElementById('my-text'),
            myTranslatedText: document.getElementById('my-translated-text'),
            myTranslatedTextLocate: document.getElementById('my-translated-text-locate'),
            sendButton: document.getElementById('send-btn')
        };
    },

    initManualSelectionUI() {
        this.elements.selectChatArea.addEventListener('click', this.listeners.selectChatArea );
        this.elements.selectInputArea.addEventListener('click', this.listeners.selectInputArea );
        this.elements.partnerTextLocate.addEventListener('click', this.listeners.partnerTextLocate );
        this.elements.myTranslatedTextLocate.addEventListener('click', this.listeners.myTranslatedTextLocate );
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
            Logger.warn('No active tab found.');
            return;
        }

        this.state.tabId = tabs[0].id;
        Logger.debug('Sidepanel tab initialized with Tab ID:', this.state.tabId);

        try {
            this.sendMessage({
                type: 'sidePanelOpened',
                tabId: this.state.tabId
            });
        } catch (error) {
            Logger.warn('Error in sending sidePanelOpened:', error);
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
            Logger.warn('Error updating languages:', error);
            return;
        } finally {
            this.elements.loadingOverlay.classList.add('hidden');
            this.disableInputs(false);
        }

        try {
            const translated = await TranslationService.translateText(this.elements.myText.value, false);
            this.elements.myTranslatedText.value = translated;
        } catch (error) {
            Logger.warn('Error translating text:', error);
        }
    },

    disableInputs(disabled) {
        Object.values(this.elements).forEach(element => {
            if (element && typeof element.disabled !== 'undefined') {
                element.disabled = disabled;
            }
        });
    },

    setupPortListeners() {
        // Disconnect any existing port
        if (this.state.port) {
            this.state.port.disconnect();
        }

        if (!this.state.tabId) {
            this.initializeTab();
        }

        // Create a long-lived connection
        this.state.port = chrome.tabs.connect(this.state.tabId, { name: PORT_NAME });

        // Set up port message listener
        this.state.port.onMessage.addListener((message) => {
            Logger.debug('Sidepanel received message:', message);
            this.handlePortMessage(message);
        });

        // Handle port disconnection
        this.state.port.onDisconnect.addListener(() => {
            Logger.debug('Port disconnected');
            this.cleanup();
        });

        Logger.debug('Side panel port connection established');
    },

    handlePortMessage(message) {
        switch (message.type) {

            case 'elementSelected':
                Logger.debug('Sidepanel Element selected:', message.elementType, this.elements.chatDetectionMessage);
                this.state.selectedElements[message.elementType] = true;

                if (message.elementType === 'chatArea' && this.elements.chatDetectionMessage) {
                    this.elements.chatDetectionMessage.classList.add('hidden');
                }

                if (this.state.selectedElements['chatArea'] && this.state.selectedElements['inputArea']) {
                    this.elements.myText.focus();
                    this.elements.myText.scrollIntoView();
                }
                break;

            case 'chatMessageDetected':
                this.updatePartnerText(message.text);
                break;

            case 'closeSidePanel':
                Logger.debug('Closing side panel');
                this.cleanup();
                window.close();
                break;
        }
    },

    // Method to send messages through the port
    sendMessage(message) {
        if (!this.state.port) {
            Logger.info('Port connection not established', message);
            this.setupPortListeners();
        }
        if (this.state.port) {
            this.state.port.postMessage(message);
        }
    },

    setupEventListeners() {
        Logger.debug('Sidepanel setting up event listeners ***', this.state.tabId);

        // Add event listeners
        this.elements.myText.addEventListener('input', this.listeners.myTextInput);
        this.elements.sendButton?.addEventListener('click', this.listeners.sendButton);
        this.elements.myText.addEventListener('keydown', this.listeners.myTextKeyDown);
        this.elements.myLangSelect.addEventListener('change', this.listeners.myLangSelectChange);
        this.elements.setLangsBtn.addEventListener('click', this.listeners.setLangsBtnClick);

        // Populate source language select
        getAllLanguages().forEach(lang => {
            const option = new Option(lang.displayName, lang.code);
            this.elements.myLangSelect.add(option);
        });
    },

    async handleSend() {
        Logger.debug('Sidepanel Sending message to content script');
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

        // Copy translatedMyText to clipboard
        navigator.clipboard.writeText(translatedMyText).then(() => {
            handleUserMessage('My translated text copied!', 'success');
        }).catch(err => {
            Logger.warn('Error copying text to clipboard:', err);
        });

        // Send message to content script
        const finalTranslatedText = this.elements.myTranslatedText.value;
        setTimeout(() => {
            if (finalTranslatedText) {
                this.sendMessage({
                    type: 'injectTextIntoChat',
                    text: finalTranslatedText
                });
            }
        }, 500);

        this.initDisplay();
    },

    cleanup() {
        // Disconnect port if it exists
        if (this.state.port) {
            try {
                this.state.port.disconnect();
            } catch (error) {
                Logger.warn('Error disconnecting port:', error);
            }
            this.state.port = null;
        }

        // Remove event listeners
        this.elements.myText.removeEventListener('input', this.listeners.myTextInput);
        this.elements.sendButton?.removeEventListener('click', this.listeners.sendButton);
        this.elements.myText.removeEventListener('keydown', this.listeners.myTextKeyDown);
        this.elements.myLangSelect.removeEventListener('change', this.listeners.myLangSelectChange);
        this.elements.setLangsBtn.removeEventListener('click', this.listeners.setLangsBtnClick);

        this.elements.selectChatArea.removeEventListener('click', this.listeners.selectChatArea);
        this.elements.selectInputArea.removeEventListener('click', this.listeners.selectInputArea);
        this.elements.partnerTextLocate.removeEventListener('click', this.listeners.partnerTextLocate);
        this.elements.myTranslatedTextLocate.removeEventListener('click', this.listeners.myTranslatedTextLocate);

        this.initState();
    },

    async init() {
        this.elements = this.getElements();
        this.state = this.initState();
        this.initManualSelectionUI();
        this.initDisplay();
        this.initHistory();

        // Initialize tab and message listeners first
        await this.initializeTab();
        // Set up message listeners before sending initialization message
        this.setupPortListeners();


        this.setupEventListeners();
        // Then initialize the rest
        await this.initLanguages();
        await TranslationService.initTranslation(this.state.selectedLanguages);
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function initSidePanel() {
    Logger.info('SidePanel loaded');
    SidePanel.init();
    document.removeEventListener('DOMContentLoaded', initSidePanel);
});
