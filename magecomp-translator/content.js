// Magecomp Chat Auto-Translator
console.log('🌐 Magecomp Auto-Translator loaded');

const translationCache = new Map();
const translatingMessages = new Set();
let isProcessing = false; // Prevent concurrent execution

// Extract clean message text
function getCleanMessageText(msgElement) {
    const clone = msgElement.cloneNode(true);
    clone.querySelectorAll('button, .auto-translation, .translation-loading').forEach(el => el.remove());
    let text = clone.textContent.trim();
    text = text.replace(/✷/g, '').trim();
    text = text.replace(/Reply\\s+Forward\\s+Bookmark\\s+Delete/gi, '').trim();
    text = text.replace(/\\(Renze\\)/gi, '').replace(/\\(Bas\\)/gi, '').trim();
    text = text.replace(/\\(Customer Support A\\.\\)/gi, '').trim();
    text = text.replace(/\\(API\\)/gi, '').trim();
    return text;
}

// Translate text using background script (no CORS issues)
async function translateText(text) {
    if (translationCache.has(text)) {
        return translationCache.get(text);
    }
    
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { action: 'translate', text },
            (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Runtime error:', chrome.runtime.lastError);
                    resolve(null);
                    return;
                }
                
                if (response && response.success) {
                    // Only cache if translation is different from original
                    if (response.translation.toLowerCase() !== text.toLowerCase()) {
                        const result = {
                            translation: response.translation,
                            detectedLang: response.detectedLang
                        };
                        translationCache.set(text, result);
                        console.log(`✅ Translated [${response.detectedLang} → en]: "${text.substring(0, 30)}..."`);
                        resolve(result);
                    } else {
                        console.log(`⏭️ Skipped (already English): "${text.substring(0, 40)}..."`);
                        resolve(null);
                    }
                } else {
                    console.error('❌ Translation failed');
                    resolve(null);
                }
            }
        );
    });
}

// Process and translate messages
async function processMessages() {
    if (isProcessing) {
        console.log('⏸️ Already processing, skipping...');
        return;
    }
    
    isProcessing = true;
    const messages = document.querySelectorAll('.msg_pos.chat__message_received, .msg_pos.chat__message_send');
    
    // Convert to array and REVERSE to process from bottom to top (newest first)
    const messagesArray = Array.from(messages).reverse();
    console.log(`🔍 Checking ${messagesArray.length} messages (bottom to top)`);
    
    for (const msg of messagesArray) {
        if (msg.hasAttribute('data-translated')) {
            continue;
        }
        
        const text = getCleanMessageText(msg);
        
        if (text.length < 5) {
            msg.setAttribute('data-translated', 'skip');
            continue;
        }
        
        const messageId = text.substring(0, 50);
        if (translatingMessages.has(messageId)) {
            continue;
        }
        
        translatingMessages.add(messageId);
        
        // Add loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'translation-loading';
        loadingDiv.textContent = '⏳ Translating...';
        msg.appendChild(loadingDiv);
        
        try {
            const result = await translateText(text);
            
            if (loadingDiv.parentNode) {
                loadingDiv.remove();
            }
            
            if (result && result.translation) {
                // Create translation div
                const translationDiv = document.createElement('div');
                translationDiv.className = 'auto-translation';
                
                // Add language badge
                const langBadge = document.createElement('span');
                langBadge.className = 'lang-badge';
                langBadge.textContent = result.detectedLang.toUpperCase();
                langBadge.title = `Detected language: ${result.detectedLang}`;
                
                translationDiv.appendChild(langBadge);
                translationDiv.appendChild(document.createTextNode(' ' + result.translation));
                
                // Find the correct container based on message type
                let targetContainer = null;
                
                // For sent messages (green bubbles)
                if (msg.classList.contains('chat__message_send')) {
                    // Try regular body first
                    targetContainer = msg.querySelector('.chat__message_send_body');
                    // If not found, try the body_button_body (for messages with images)
                    if (!targetContainer) {
                        targetContainer = msg.querySelector('.chat__message_send_body_button_body');
                    }
                }
                
                // For received messages
                if (msg.classList.contains('chat__message_received')) {
                    // Try regular body first
                    targetContainer = msg.querySelector('.chat__message_received_body');
                    // If not found, try the body_button_body (for messages with images)
                    if (!targetContainer) {
                        targetContainer = msg.querySelector('.chat__message_received_body_button_body');
                    }
                }
                
                // Append translation inside the message bubble
                if (targetContainer) {
                    targetContainer.appendChild(translationDiv);
                    msg.setAttribute('data-translated', 'yes');
                } else {
                    console.warn('⚠️ Could not find container for translation:', msg);
                    msg.setAttribute('data-translated', 'error');
                }
            } else {
                msg.setAttribute('data-translated', 'skip');
            }
            
            translatingMessages.delete(messageId);
        } catch (err) {
            console.error('Translation error:', err);
            if (loadingDiv.parentNode) {
                loadingDiv.remove();
            }
            msg.setAttribute('data-translated', 'error');
            translatingMessages.delete(messageId);
        }
        
        await new Promise(resolve => setTimeout(resolve, 400));
    }
    
    console.log('✅ Translation scan complete');
    isProcessing = false;
}

// Initial translation
setTimeout(() => {
    console.log('🌐 Starting initial translation scan...');
    processMessages();
}, 2000);

// Re-check for new messages
setInterval(() => {
    processMessages();
}, 5000);

// Watch for DOM changes - DEBOUNCED
let mutationTimeout;
const observer = new MutationObserver(() => {
    // Debounce: only process after 1 second of no changes
    clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
        processMessages();
    }, 1000);
});

setTimeout(() => {
    const chatRegions = document.querySelectorAll('[aria-label="scrollable content"]');
    chatRegions.forEach(region => {
        observer.observe(region, {
            childList: true,
            subtree: false
        });
    });
    console.log(`👀 Watching ${chatRegions.length} chat regions`);
}, 1500);