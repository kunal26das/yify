import org.gradle.kotlin.dsl.compose
import org.gradle.kotlin.dsl.implementation
import org.jetbrains.kotlin.gradle.ExperimentalKotlinGradlePluginApi
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.compose)
    alias(libs.plugins.googleServices)
    alias(libs.plugins.crashlytics)
    alias(libs.plugins.firebasePerf)
}

kotlin {
    androidTarget {
        @OptIn(ExperimentalKotlinGradlePluginApi::class)
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_21)
        }
    }

    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "app"
            isStatic = true
        }
    }

    sourceSets {
        androidMain.dependencies {
            implementation(compose.preview)
            implementation(libs.androidx.activity.compose)

            implementation(project(":app:movies"))
            implementation(project(":app:movies:data"))
            implementation(project(":app:movies:domain"))

            implementation(libs.androidx.core.ktx)
            implementation(libs.material)

            implementation(libs.androidx.startup.runtime)
            implementation(libs.androidx.core.splashscreen)
            implementation(libs.androidx.activity.ktx)
            implementation(libs.androidx.datastore)
            implementation("androidx.navigation:navigation-compose:2.8.2")

            implementation(libs.coil.compose)

            implementation(libs.firebase.appcheck.playintegrity)
            implementation(libs.firebase.crashlytics.ktx)
            implementation(libs.firebase.performance)
            implementation(libs.integrity)

            implementation(libs.koin.android)
            implementation(libs.koin.androidx.startup)

            implementation(libs.youtube.player)
        }

        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            implementation(compose.components.resources)
            implementation(compose.components.uiToolingPreview)
//            implementation(libs.androidx.lifecycle.viewmodel.ktx)
//            implementation(libs.androidx.lifecycle.runtime.compose)
        }
    }
    sourceSets {
        val commonMain by getting
        val androidMain by getting {
            dependencies {
                implementation(libs.symbol.processing.api)
            }
        }
    }
}

dependencies {
    implementation(platform(libs.firebase.bom))
    implementation(platform(libs.koin.bom))
}

android {
    namespace = ProjectConfig.applicationId
    compileSdk = ProjectConfig.compileSdk

    sourceSets["main"].manifest.srcFile("src/androidMain/AndroidManifest.xml")
    sourceSets["main"].res.srcDirs("src/androidMain/res")
    sourceSets["main"].resources.srcDirs("src/commonMain/resources")

    defaultConfig {
        applicationId = ProjectConfig.applicationId
        minSdk = ProjectConfig.minSdk
        targetSdk = ProjectConfig.targetSdk
        versionCode = ProjectConfig.versionCode
        versionName = ProjectConfig.versionName
        setProperty("archivesBaseName", "v${versionName}-${versionCode}")
    }
    buildFeatures {
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = ProjectConfig.javaVersion
        targetCompatibility = ProjectConfig.javaVersion
    }
    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"

            isDebuggable = true
            isMinifyEnabled = false

            buildConfigField("String", "BASE_URL", "\"https://yts.mx/api/v2/\"")
            buildConfigField("String", "DNS_URL", "\"https://1.1.1.1/dns-query\"")
        }

        release {
            isDebuggable = false
            isMinifyEnabled = false

            buildConfigField("String", "BASE_URL", "\"https://yts.mx/api/v2/\"")
            buildConfigField("String", "DNS_URL", "\"https://1.1.1.1/dns-query\"")

            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )

            signingConfig = signingConfigs.getByName("debug")
        }
    }
    lint {
        baseline = file("lint-baseline.xml")
        disable.add("EnsureInitializerMetadata")
    }
}

