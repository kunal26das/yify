import {Platform} from 'react-native';

const ANDROID_MESSAGE_BRIDGE = `(function(){
  if (window.__yifyMessageBridge) return;
  window.__yifyMessageBridge = true;
  document.addEventListener('message', function (event) {
    var payload = event.data;
    try {
      var parsed = JSON.parse(payload);
      if (parsed && parsed.eventName) payload = parsed.eventName;
    } catch (error) {}
    window.dispatchEvent(new MessageEvent('message', {data: payload}));
  });
})(); true;`;

export const YOUTUBE_WEB_VIEW_PROPS = {
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false,
    allowsFullscreenVideo: true,
    ...(Platform.OS === 'android' ? {injectedJavaScript: ANDROID_MESSAGE_BRIDGE} : null),
};
