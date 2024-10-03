import com.android.build.api.dsl.VariantDimension
import com.android.build.gradle.LibraryExtension
import com.android.build.gradle.TestedExtension
import com.android.build.gradle.internal.dsl.BaseAppModuleExtension
import org.gradle.api.Action
import org.gradle.api.Project
import org.gradle.api.artifacts.dsl.DependencyHandler
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.kotlin.dsl.project
import java.util.Properties

fun Project.application(configure: Action<BaseAppModuleExtension>) {
    extensions.getByType(BaseAppModuleExtension::class.java).apply {
        compileSdk = ProjectConfig.compileSdk
        defaultConfig {
            applicationId = ProjectConfig.applicationId
            targetSdk = ProjectConfig.targetSdk
            versionCode = ProjectConfig.versionCode
            versionName = ProjectConfig.versionName
            setProperty("archivesBaseName", "v${versionName}-${versionCode}")
        }
        buildFeatures {
            buildConfig = true
        }
        commonConfig()
        configure.execute(this)
    }
}

private fun TestedExtension.commonConfig(name: String = "") {
    namespace = ProjectConfig.applicationId + when {
        name.isEmpty().not() -> ".$name"
        else -> ""
    }
    defaultConfig {
        minSdk = ProjectConfig.minSdk
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    compileOptions {
        sourceCompatibility = ProjectConfig.javaVersion
        targetCompatibility = ProjectConfig.javaVersion
    }
}

fun Project.androidModule(
    name: String,
    configure: Action<LibraryExtension>,
) {
    extensions.getByType(LibraryExtension::class.java).apply {
        compileSdk = ProjectConfig.compileSdk
        buildFeatures {
            buildConfig = true
        }
        commonConfig(name)
        configure.execute(this)
    }
}

fun Project.kotlinModule(
    configure: Action<JavaPluginExtension> = Action<JavaPluginExtension> { },
) {
    extensions.getByType(JavaPluginExtension::class.java).apply {
        sourceCompatibility = ProjectConfig.javaVersion
        targetCompatibility = ProjectConfig.javaVersion
        configure.execute(this)
    }
}

fun VariantDimension.stringField(key: String, value: String) {
    buildConfigField("String", key, "\"$value\"")
}

fun VariantDimension.stringField(properties: Properties, key: String) {
    stringField(key, (properties[key] as? String).orEmpty())
}

fun DependencyHandler.common() {
    implementation(project(":app:common"))
    implementation(project(":app:common:domain"))
}

fun DependencyHandler.movies() {
    implementation(project(":app:movies"))
    implementation(project(":app:movies:domain"))
}