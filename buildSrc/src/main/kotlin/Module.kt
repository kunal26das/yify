import com.android.build.api.dsl.VariantDimension
import com.android.build.gradle.LibraryExtension
import com.android.build.gradle.TestedExtension
import com.android.build.gradle.internal.dsl.BaseAppModuleExtension
import org.gradle.api.Action
import org.gradle.api.JavaVersion
import org.gradle.api.Project
import org.gradle.api.artifacts.dsl.DependencyHandler
import org.gradle.api.plugins.JavaPluginExtension
import org.gradle.kotlin.dsl.project
import java.io.FileInputStream
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
            compose = true
            buildConfig = true
        }
        commonConfig()
        configure.execute(this)
    }
}

@Suppress("UnstableApiUsage")
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
    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.10"
    }
}

fun Project.androidModule(
    name: String,
    enableCompose: Boolean = true,
    configure: Action<LibraryExtension>,
) {
    extensions.getByType(LibraryExtension::class.java).apply {
        compileSdk = ProjectConfig.compileSdk
        buildFeatures {
            compose = enableCompose
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
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        configure.execute(this)
    }
}

fun Project.properties(file: String, callback: (Properties) -> Unit = {}) {
    val propertiesFile = rootProject.file(file)
    val properties = Properties()
    properties.load(FileInputStream(propertiesFile))
    callback.invoke(properties)
}

fun VariantDimension.stringField(key: String, value: String) {
    buildConfigField("String", key, value)
}

fun VariantDimension.stringField(properties: Properties, key: String) {
    stringField(key, (properties[key] as? String).orEmpty())
}

fun Properties.string(key: String): String {
    return (get(key) as? String).orEmpty()
}

fun DependencyHandler.common() {
    implementation(project(":common"))
    implementation(project(":common:domain"))
}

fun DependencyHandler.movies() {
    implementation(project(":movies"))
    implementation(project(":movies:domain"))
}