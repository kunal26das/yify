const fs = require('node:fs/promises');
const path = require('node:path');
const {withAppBuildGradle, withDangerousMod} = require('@expo/config-plugins');

const BLOCK = `androidComponents {
    onVariants(selector().all()) { variant ->
        def umpArtifact = variant.runtimeConfiguration.incoming.artifactView {
            attributes { attribute(org.gradle.api.artifacts.type.ArtifactTypeDefinition.ARTIFACT_TYPE_ATTRIBUTE, 'aar') }
            componentFilter { component ->
                def ump = component instanceof org.gradle.api.artifacts.component.ModuleComponentIdentifier && component.group == 'com.google.android.ump' && component.module == 'user-messaging-platform'
                if (ump && component.version != '4.0.0') throw new GradleException('Review the UMP metrics guard before changing SDK version ' + component.version)
                return ump
            }
        }.files
        variant.instrumentation.transformClassesWith(io.github.kunal26das.yify.ump.UmpMetricsFactory, com.android.build.api.instrumentation.InstrumentationScope.ALL) { parameters ->
            parameters.umpArtifact.from(umpArtifact)
        }
        variant.instrumentation.setAsmFramesComputationMode(com.android.build.api.instrumentation.FramesComputationMode.COMPUTE_FRAMES_FOR_INSTRUMENTED_METHODS)
    }
}
`;

module.exports = (config) => withDangerousMod(withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') throw new Error('withUmpMetricsGuard requires Groovy app Gradle.');
    const contents = cfg.modResults.contents;
    if (contents.includes(BLOCK)) return cfg;
    if (contents.includes('UmpMetricsFactory')) throw new Error('Existing UMP instrumentation differs; review before generation.');
    cfg.modResults.contents = `${contents.trimEnd()}\n\n${BLOCK}`;
    return cfg;
}), ['android', async (cfg) => {
    const root = path.join(cfg.modRequest.platformProjectRoot, 'buildSrc');
    const files = ['build.gradle', 'UmpMetricsFactory.java', 'UmpMetricsVisitor.java'];
    for (const filename of files) {
        const target = filename.endsWith('.java') ? path.join(root, 'src/main/java/io/github/kunal26das/yify/ump', filename) : path.join(root, filename);
        const source = await fs.readFile(path.join(__dirname, 'ump', filename), 'utf8');
        if (filename === 'build.gradle') {
            const existing = await fs.readFile(target, 'utf8').catch(error => {
                if (error.code !== 'ENOENT') throw error;
                return null;
            });
            if (existing !== null && existing !== source) throw new Error('Existing Android buildSrc configuration requires a reviewed merge.');
        }
        await fs.mkdir(path.dirname(target), {recursive: true});
        await fs.writeFile(target, source);
    }
    return cfg;
}]);
