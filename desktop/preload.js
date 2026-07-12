const {contextBridge} = require('electron');

contextBridge.exposeInMainWorld('yifyDesktop', {
    isDesktop: true,
    platform: process.platform,
});
