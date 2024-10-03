plugins {
    kotlin("android")
    id("com.android.library")
    alias(libs.plugins.ksp)
    alias(libs.plugins.composeCompiler)
}

android {
    namespace = "${ProjectConfig.applicationId}.common"
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
    implementation(project(":app:common:domain"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.ui.tooling)
    implementation(libs.androidx.activity.compose)
    implementation(libs.coil.compose)

    implementation(libs.hilt.android)
    ksp(libs.hilt.android.compiler)
    implementation(libs.androidx.activity.ktx)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.crashlytics.ktx)

    implementation(libs.androidx.datastore)
    implementation(libs.androidx.datastore.preferences)
}