const {contextBridge} = require('electron');

// Minimal, safe bridge. Exposes a flag so web code can detect the desktop shell
// if it ever needs platform-specific behaviour.
contextBridge.exposeInMainWorld('yifyDesktop', {
    isDesktop: true,
    platform: process.platform,
});
