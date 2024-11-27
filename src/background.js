import { Logger, LogLevel } from './utils/logger';
Logger.info('Background script loaded');
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
if (Logger.level === LogLevel.DEBUG) {
    chrome.runtime.onInstalled.addListener((details) => {
        if (details.reason === 'install') {
            Logger.debug('Background - Fresh installation detected');
            // Add your initialization code here
        } else if (details.reason === 'update') {
            Logger.debug('Background - Extension updated from version', details.previousVersion);
        }
    });
}
