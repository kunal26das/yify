import {readFileSync} from 'node:fs';

const MANIFEST = 'android/app/src/main/AndroidManifest.xml';
const xml = readFileSync(MANIFEST, 'utf8');

const match = xml.match(/UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY"[\s\S]*?android:value="([^"]*)"/);
if (!match) {
    console.error(`${MANIFEST}: no expo-updates request headers meta-data found`);
    process.exit(1);
}

const value = match[1].replace(/&quot;/g, '"');
if (!value.includes('"expo-channel-name":"Production"')) {
    console.error(`${MANIFEST}: committed OTA channel is ${value}, expected Production.`);
    console.error('Regenerate it with: EXPO_UPDATE_CHANNEL=Production npx expo prebuild --platform android');
    process.exit(1);
}
console.log('Committed AndroidManifest targets the Production OTA channel');
