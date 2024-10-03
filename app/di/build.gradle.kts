plugins {
    kotlin("android")
    id("com.android.library")
    alias(libs.plugins.ksp)
}

android {
    namespace = "${ProjectConfig.applicationId}.di"
    compileSdk = ProjectConfig.compileSdk
    defaultConfig {
        minSdk = ProjectConfig.minSdk
    }
    buildFeatures {
        buildConfig = true
    }
    compileOptions {
        sourceCompatibility = ProjectConfig.javaVersion
        targetCompatibility = ProjectConfig.javaVersion
    }
}

dependencies {
    implementation(project(":app:movies:data"))

    implementation(libs.hilt.android)
    ksp(libs.hilt.android.compiler)
}