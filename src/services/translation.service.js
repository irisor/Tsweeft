import { handleMessage } from "../utils/messageUtil";

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
            handleMessage('No translation available for this language pair', 'error');
            return null;
        }

        try {
            return await translation.createTranslator(languagePair);
        } catch (error) {
            handleMessage('Error setting translation', 'error');
            console.error('Error setting translation', error);
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
            handleMessage('Failed to setup translation', 'error');
            console.error('Failed to setup translation', error);
            return false;
        }
    },

    async translateText(text, isPartnerToMy = false) {
        const translator = isPartnerToMy ? this.partnerToMyTranslator : this.myToPartnerTranslator;
        if (!translator) return '';
        return await translator.translate(text);
    }
};
