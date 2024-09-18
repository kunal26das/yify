plugins {
    kotlin("android")
    id("com.android.library")
    alias(libs.plugins.ksp)
}

androidModule("di") {
    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

dependencies {
    implementation(project(":movies:data"))

    implementation(libs.hilt.android)
    ksp(libs.hilt.android.compiler)
}