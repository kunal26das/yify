plugins {
    kotlin("android")
    id("com.android.library")
    id("com.google.devtools.ksp")
}

androidModule("di", false) {
    buildTypes {
        release {
            isMinifyEnabled = true
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