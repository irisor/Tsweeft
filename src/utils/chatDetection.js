// Common selectors that work across languages
const COMMON_INPUT_SELECTORS = [
    // Technical selectors (language-independent)
    'textarea',
    'input[type="text"]',
    '[contenteditable="true"]',
    '[role="textbox"]',
    
    // Common class patterns (often used in frameworks)
    '[class*="chat"]',
    '[class*="message"]',
    '[class*="composer"]',
    '[class*="input"]',
    '[class*="editor"]',
    
    // Common attributes (often automatically generated)
    '[data-testid*="input"]',
    '[data-testid*="chat"]',
    '[data-testid*="message"]',
    
    // Common component names (framework-specific)
    '[class*="MessageInput"]',
    '[class*="ChatInput"]',
    '[class*="ComposerInput"]'
];

const COMMON_CONTAINER_SELECTORS = [
    // Technical selectors
    '[role="log"]',
    '[aria-live="polite"]',
    
    // Common class patterns
    '[class*="chat"]',
    '[class*="message"]',
    '[class*="conversation"]',
    '[class*="thread"]',
    
    // Common component names
    '[class*="MessageList"]',
    '[class*="ChatContainer"]',
    '[class*="ConversationView"]'
];

/**
 * Calculate score for potential chat input element
 * @param {Element} element
 * @returns {number}
 */
function calculateInputScore(element) {
    let score = 0;
    const classList = Array.from(element.classList);
    const tagName = element.tagName.toLowerCase();
    const attributes = Array.from(element.attributes).map(attr => attr.name);
    const styles = window.getComputedStyle(element);

    // Technical characteristics (language-independent)
    if (tagName === 'textarea' || tagName === 'input') score += 2;
    if (element.getAttribute('contenteditable') === 'true') score += 2;
    if (element.getAttribute('role') === 'textbox') score += 2;
    if (element.getAttribute('type') === 'text') score += 1;

    // Input characteristics
    const isTypingField = element.tagName === 'INPUT' || 
                         element.tagName === 'TEXTAREA' || 
                         element.getAttribute('contenteditable') === 'true';
    if (isTypingField) score += 3;

    // Common technical class patterns
    const technicalTerms = ['input', 'editor', 'compose', 'textbox', 'field'];
    score += classList.reduce((acc, cls) => {
        const normalized = cls.toLowerCase();
        return acc + technicalTerms.reduce((sum, term) => 
            sum + (normalized.includes(term) ? 1 : 0), 0);
    }, 0);

    // Position and style characteristics
    if (isElementNearBottom(element)) score += 2;
    if (styles.position === 'fixed' || styles.position === 'sticky') score += 1;
    if (parseInt(styles.zIndex) > 0) score += 1;

    // Common input attributes
    if (attributes.includes('maxlength')) score += 1;
    if (attributes.includes('autocomplete')) score += 1;
    if (attributes.includes('spellcheck')) score += 1;

    return score;
}

/**
 * Calculate score for potential chat container element
 * @param {Element} element
 * @returns {number}
 */
function calculateContainerScore(element) {
    let score = 0;
    const classList = Array.from(element.classList);
    const styles = window.getComputedStyle(element);

    // Technical characteristics
    if (element.getAttribute('role') === 'log') score += 2;
    if (element.getAttribute('aria-live') === 'polite') score += 2;

    // Common technical class patterns
    const technicalTerms = ['container', 'list', 'view', 'thread', 'log'];
    score += classList.reduce((acc, cls) => {
        const normalized = cls.toLowerCase();
        return acc + technicalTerms.reduce((sum, term) => 
            sum + (normalized.includes(term) ? 1 : 0), 0);
    }, 0);

    // Structure characteristics
    if (hasScrollableCharacteristics(element)) score += 3;
    if (containsMessageLikeElements(element)) score += 4;
    if (containsTimePatterns(element)) score += 2;

    // Style characteristics
    if (styles.overflow === 'auto' || styles.overflow === 'scroll') score += 2;
    if (styles.display === 'flex' || styles.display === 'grid') score += 1;
    if (parseInt(styles.height) > 200) score += 1;

    return score;
}

/**
 * Check if element has characteristics of message elements
 * @param {Element} element
 * @returns {boolean}
 */
function containsMessageLikeElements(element) {
    const children = element.children;
    if (children.length < 2) return false;

    let messagePatternCount = 0;
    for (const child of children) {
        // Check for alternating patterns
        const hasAlternatingStructure = child.nextElementSibling && 
            child.getBoundingClientRect().width !== child.nextElementSibling.getBoundingClientRect().width;
        
        // Check for message-like structure
        const hasMessageStructure = 
            child.querySelector('img') || // Avatar
            child.querySelectorAll('div, p').length > 1 || // Content with structure
            child.querySelector('time') || // Timestamp
            child.textContent.length > 20; // Sufficient content
        
        if (hasAlternatingStructure || hasMessageStructure) {
            messagePatternCount++;
        }
    }

    return messagePatternCount >= 2;
}

/**
 * Check if element has scrollable characteristics
 * @param {Element} element
 * @returns {boolean}
 */
function hasScrollableCharacteristics(element) {
    const style = window.getComputedStyle(element);
    return (style.overflowY === 'scroll' || style.overflowY === 'auto') &&
           (element.scrollHeight > element.clientHeight);
}

/**
 * Check if element contains time patterns
 * @param {Element} element
 * @returns {boolean}
 */
function containsTimePatterns(element) {
    const text = element.textContent;
    // Universal time patterns (numeric)
    const timePatterns = [
        /\d{1,2}:\d{2}/,  // 3:45, 15:45
        /\d{1,2}(?::|\.)\d{2}(?:\s*[AaPp][Mm])?/, // 3:45pm, 15.45
        /\d{1,2}\s*(?::|\.)\s*\d{2}/  // 3 : 45, 15 . 45
    ];
    
    return timePatterns.some(pattern => pattern.test(text));
}

/**
 * Check if element is positioned near the bottom of viewport or its container
 * @param {Element} element
 * @returns {boolean}
 */
function isElementNearBottom(element) {
    const rect = element.getBoundingClientRect();
    const parentRect = element.parentElement?.getBoundingClientRect();
    if (!parentRect) return false;

    const viewportHeight = window.innerHeight;
    const distanceFromBottom = viewportHeight - rect.bottom;
    const distanceFromParentBottom = parentRect.bottom - rect.bottom;

    return distanceFromBottom < 100 || distanceFromParentBottom < 100;
}

/**
 * Find the most likely chat input element
 * @returns {Element|null}
 */
export function findChatInput() {
    // Try common selectors first
    for (const selector of COMMON_INPUT_SELECTORS) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            if (elements.length === 1) return elements[0];
            
            // Score multiple matches
            const scored = Array.from(elements)
                .map(el => ({ element: el, score: calculateInputScore(el) }))
                .sort((a, b) => b.score - a.score);
            
            if (scored[0].score > 3) return scored[0].element;
        }
    }

    // Fallback to scoring all potential inputs
    const potentialInputs = document.querySelectorAll('textarea, input[type="text"], [contenteditable="true"]');
    if (potentialInputs.length === 0) return null;

    const scored = Array.from(potentialInputs)
        .map(el => ({ element: el, score: calculateInputScore(el) }))
        .sort((a, b) => b.score - a.score);

    return scored[0].score > 3 ? scored[0].element : null;
}

/**
 * Find the most likely chat container element
 * @returns {Element|null}
 */
export function findChatContainer() {
    // Try common selectors first
    for (const selector of COMMON_CONTAINER_SELECTORS) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            if (elements.length === 1) return elements[0];
            
            // Score multiple matches
            const scored = Array.from(elements)
                .map(el => ({ element: el, score: calculateContainerScore(el) }))
                .sort((a, b) => b.score - a.score);
            
            if (scored[0].score > 4) return scored[0].element;
        }
    }

    // Fallback to scoring potential containers
    const potentialContainers = document.querySelectorAll('div, section, main, article');
    const scored = Array.from(potentialContainers)
        .map(el => ({ element: el, score: calculateContainerScore(el) }))
        .sort((a, b) => b.score - a.score);

    return scored[0].score > 4 ? scored[0].element : null;
}

/**
 * Get a unique selector for an element
 * @param {Element} element
 * @returns {string|null}
 */
function getUniqueSelector(element) {
    if (!element) return null;
    
    // Try ID
    if (element.id) return `#${element.id}`;
    
    // Try unique class combination
    const classes = Array.from(element.classList);
    if (classes.length > 0) {
        const classSelector = `.${classes.join('.')}`;
        if (document.querySelectorAll(classSelector).length === 1) {
            return classSelector;
        }
    }
    
    // Generate path
    const path = [];
    let current = element;
    while (current) {
        let selector = current.tagName.toLowerCase();
        
        if (current.id) {
            selector = `#${current.id}`;
            path.unshift(selector);
            break;
        }
        
        const siblings = Array.from(current.parentElement?.children || []);
        if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-child(${index})`;
        }
        
        path.unshift(selector);
        current = current.parentElement;
    }
    
    return path.join(' > ');
}

// // Example usage:
// const chatInput = findChatInput();
// const chatContainer = findChatContainer();
