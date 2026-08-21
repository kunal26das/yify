const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('yifyDesktop', {
    isDesktop: true,
    platform: process.platform,
    setNotificationSettings: (value) => ipcRenderer.send('yify:notification-settings', value),
});
