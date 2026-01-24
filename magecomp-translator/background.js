// Background service worker to handle translation (bypasses CORS)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(request.text)}`;
    
    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data && data[0]) {
          const translation = data[0]
            .filter(item => item && item[0])
            .map(item => item[0])
            .join('');
          const detectedLang = data[2] || 'auto';
          
          sendResponse({ 
            success: true, 
            translation, 
            detectedLang 
          });
        } else {
          sendResponse({ success: false });
        }
      })
      .catch(error => {
        console.error('Translation error:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep channel open for async response
  }
});