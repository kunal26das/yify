export const sourcePattern = /^[a-f0-9]{40}$/;
export const variants = {
    legacy: {version: '2.0.1', packageName: 'io.github.kunal26das.hsdpregression.legacy',
        aarSha256: '5e57065e411d985f4e4eb0cd028c617c3a5d3bf836d20fc524ec23a0df39af75'},
    fixed: {version: '2.2.0', packageName: 'io.github.kunal26das.hsdpregression.fixed',
        aarSha256: '39e1e335b512c66b166fd6c74e360a480564541745c57ad4a89bdb581d0bdcdd'},
};
export const cases = ['raw-missing', 'attached', 'configuration', 'new-intent'];
export const fixedOnlyCases = ['empty-create', 'null-create'];
export const images = {
    '30': 'system-images;android-30;default;x86_64',
    '36': 'system-images;android-36;default;x86_64',
};
export const toolchain = {java: 17, sdkToolsJava: 17, cmdlineTools: '12.0', buildTools: '37.0.0',
    platform: 'platforms;android-37.0', gradle: '9.4.1', agp: '9.2.1'};
