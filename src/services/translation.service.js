import { handleUserMessage } from "../utils/userMessageUtil";
import { Logger } from "../utils/logger";

export const TranslationService = {
    myToPartnerTranslator: null,
    partnerToMyTranslator: null,

    async setupTranslation(fromLang, toLang) {
        const languagePair = {
            sourceLanguage: fromLang,
            targetLanguage: toLang,
        };
        
        const canTranslate = await translation.canTranslate(languagePair);

        if (canTranslate === 'no') {
            handleUserMessage('No translation available for this language pair', 'error');
            return null;
        }

        try {
            if (self.ai?.translator) {
                return await self.ai.translator.create(languagePair);
            } else {
                return await translation.createTranslator(languagePair);
            }
        } catch (error) {
            handleUserMessage('Error setting translation', 'error');
            Logger.warn('Error setting translation', error);
            return null;
        }
    },

    async initTranslation(selectedLanguages) {
        try {
            this.myToPartnerTranslator = await this.setupTranslation(
                selectedLanguages.my.code, 
                selectedLanguages.partner.code
            );
            
            if (this.myToPartnerTranslator) {
                this.partnerToMyTranslator = await this.setupTranslation(
                    selectedLanguages.partner.code, 
                    selectedLanguages.my.code
                );
            }
            
            return true;
        } catch (error) {
            handleUserMessage('Failed to setup translation', 'error');
            Logger.warn('Failed to setup translation', error);
            return false;
        }
    },

    async translateText(text, isPartnerToMy = false) {
        const translator = isPartnerToMy ? this.partnerToMyTranslator : this.myToPartnerTranslator;
        if (!translator) return '';
        try {
            return await translator.translate(text);
        } catch (error) {
            Logger.warn('Translation error:', error);
            return '';
        }
    }
};
