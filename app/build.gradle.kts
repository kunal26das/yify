import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.compose.compiler)
    alias(libs.plugins.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.google.services)
    alias(libs.plugins.crashlytics)
    alias(libs.plugins.firebase.performance)
}

kotlin {
    androidTarget {
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
            implementation(libs.coil.compose)
            implementation(libs.androidx.core.splashscreen)
            implementation(libs.androidx.activity.ktx)

            implementation(libs.firebase.appcheck.playintegrity)
            implementation(libs.integrity)
            implementation(libs.firebase.performance)

            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.android)
            implementation(libs.ktor.client.serialization)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.serialization.kotlinx.json)
            implementation(libs.ktor.client.logging)
            implementation(libs.ktor.client.okhttp)
            implementation(libs.okhttp.dnsoverhttps)

            implementation(libs.koin.android)
            implementation(libs.koin.androidx.startup)
        }

        commonMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material)
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
                implementation(libs.ksp.symbol.processing)
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
            isShrinkResources = false

            buildConfigField("String", "BASE_URL", "\"https://yts.mx/api/v2/\"")
            buildConfigField("String", "DNS_URL", "\"https://1.1.1.1/dns-query\"")
        }

        release {
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true

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

