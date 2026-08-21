const MESSAGE_BRIDGE = `(function(){
  if (window.__yifyMessageBridge) return;
  window.__yifyMessageBridge = true;
  var forward = function (payload) {
    if (typeof payload !== 'string') return;
    var parsed;
    try { parsed = JSON.parse(payload); } catch (error) { return; }
    if (!parsed || typeof parsed.eventName !== 'string') return;
    window.dispatchEvent(new MessageEvent('message', {data: parsed.eventName}));
  };
  document.addEventListener('message', function (event) { forward(event.data); });
  window.addEventListener('message', function (event) { forward(event.data); });
})(); true;`;

export const YOUTUBE_WEB_VIEW_PROPS = {
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false,
    allowsFullscreenVideo: true,
    injectedJavaScript: MESSAGE_BRIDGE,
};
