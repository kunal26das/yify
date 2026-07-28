const {withAndroidManifest, AndroidConfig} = require('@expo/config-plugins');

const REMOVED_PERMISSIONS = [
    'com.google.android.gms.permission.AD_ID',
    'android.permission.ACCESS_ADSERVICES_AD_ID',
    'android.permission.ACCESS_ADSERVICES_ATTRIBUTION',
];

module.exports = (config) =>
    withAndroidManifest(config, (cfg) => {
        const manifest = cfg.modResults.manifest;

        manifest['uses-permission'] = manifest['uses-permission'] ?? [];
        for (const name of REMOVED_PERMISSIONS) {
            const existing = manifest['uses-permission'].find(
                (entry) => entry.$?.['android:name'] === name
            );
            if (existing) {
                existing.$['tools:node'] = 'remove';
            } else {
                manifest['uses-permission'].push({
                    $: {'android:name': name, 'tools:node': 'remove'},
                });
            }
        }

        const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
        AndroidConfig.Manifest.addMetaDataItemToMainApplication(
            application,
            'google_analytics_adid_collection_enabled',
            'false',
            'value'
        );
        const metaData = application['meta-data'].find(
            (entry) => entry.$?.['android:name'] === 'google_analytics_adid_collection_enabled'
        );
        metaData.$['tools:replace'] = 'android:value';

        return cfg;
    });
