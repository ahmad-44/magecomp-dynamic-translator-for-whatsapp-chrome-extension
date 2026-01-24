// Magecomp Chat Auto-Translator
console.log('🌐 Magecomp Auto-Translator loaded');

const translationCache = new Map();
const translatingMessages = new Set();

// Extract clean message text
function getCleanMessageText(msgElement) {
    const clone = msgElement.cloneNode(true);
    
    clone.querySelectorAll('button, .auto-translation, .translation-loading').forEach(el => el.remove());
    
    let text = clone.textContent.trim();
    text = text.replace(/✷/g, '').trim();
    text = text.replace(/Reply\\s+Forward\\s+Bookmark\\s+Delete/gi, '').trim();
    text = text.replace(/\\(Renze\\)/gi, '').replace(/\\(Bas\\)/gi, '').trim();
    
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
    const messages = document.querySelectorAll('.msg_pos.chat__message_received, .msg_pos.chat__message_send');
    
    console.log(`🔍 Checking ${messages.length} messages`);
    
    for (const msg of messages) {
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
                
                msg.appendChild(translationDiv);
                
                msg.setAttribute('data-translated', 'yes');
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
}

// Initial translation
setTimeout(() => {
    console.log('🌐 Starting initial translation scan...');
    processMessages();
}, 2000);

// Re-check for new messages
setInterval(() => {
    processMessages();
}, 3000);

// Watch for DOM changes
const observer = new MutationObserver(() => {
    setTimeout(processMessages, 500);
});

setTimeout(() => {
    const chatRegions = document.querySelectorAll('[aria-label="scrollable content"]');
    chatRegions.forEach(region => {
        observer.observe(region, {
            childList: true,
            subtree: true
        });
    });
    console.log(`👀 Watching ${chatRegions.length} chat regions`);
}, 1500);