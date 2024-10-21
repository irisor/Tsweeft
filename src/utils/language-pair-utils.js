export {
	getAllLanguages,
	getTargetLanguages,
	isValidPair,
	getDisplayName
};

// Define the language pairs with display names
const languageInfo = {
	'en': 'English',
	'ar': 'Arabic',
	'bn': 'Bengali',
	'de': 'German',
	'es': 'Spanish',
	'fr': 'French',
	'hi': 'Hindi',
	'it': 'Italian',
	'ja': 'Japanese',
	'ko': 'Korean',
	'nl': 'Dutch',
	'pl': 'Polish',
	'pt': 'Portuguese',
	'ru': 'Russian',
	'th': 'Thai',
	'tr': 'Turkish',
	'vi': 'Vietnamese',
	'zh': 'Chinese (Simplified)',
	'zh-Hant': 'Chinese (Traditional)'
};

const languagePairs = [
	['en', 'ar'],
	['en', 'bn'],
	['en', 'de'],
	['en', 'es'],
	['en', 'fr'],
	['en', 'hi'],
	['en', 'it'],
	['en', 'ja'],
	['en', 'ko'],
	['en', 'nl'],
	['en', 'pl'],
	['en', 'pt'],
	['en', 'ru'],
	['en', 'th'],
	['en', 'tr'],
	['en', 'vi'],
	['en', 'zh'],
	['en', 'zh-Hant']
];

// Create a Set to store unique language codes
const uniqueLanguageCodes = new Set(languagePairs.flat());

// Create a Map to store available target languages for each source language
const languageMap = new Map();

languagePairs.forEach(([lang1, lang2]) => {
	if (!languageMap.has(lang1)) languageMap.set(lang1, new Set());
	if (!languageMap.has(lang2)) languageMap.set(lang2, new Set());

	languageMap.get(lang1).add(lang2);
	languageMap.get(lang2).add(lang1);
});

// Function to get all unique languages with their display names
function getAllLanguages() {
	return Array.from(uniqueLanguageCodes).map(code => ({
		code,
		displayName: languageInfo[code]
	}));
}

// Function to get available target languages for a given source language
function getTargetLanguages(sourceLanguageCode) {
	return Array.from(languageMap.get(sourceLanguageCode) || []).map(code => ({
		code,
		displayName: languageInfo[code]
	}));
}

// Function to check if a language pair is valid
function isValidPair(sourceLangCode, targetLangCode) {
	const targetLanguages = languageMap.get(sourceLangCode);
	return targetLanguages && targetLanguages.has(targetLangCode);
}

// Function to get display name for a language code
function getDisplayName(languageCode) {
	return languageInfo[languageCode] || languageCode;
}
