plugins {
    kotlin("android")
    id("com.android.application")
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.googleServices)
    alias(libs.plugins.crashlytics)
    alias(libs.plugins.firebasePerf)
}

application {
    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"

            isDebuggable = true
            isMinifyEnabled = false

            stringField("BASE_URL", "https://yts.mx/api/v2/")
            stringField("DNS_URL", "https://1.1.1.1/dns-query")
        }

        release {
            isDebuggable = false
            isMinifyEnabled = false

            stringField("BASE_URL", "https://yts.mx/api/v2/")
            stringField("DNS_URL", "https://1.1.1.1/dns-query")

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

dependencies {
    common()
    movies()

    implementation(project(":di"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.material)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)

    implementation(libs.hilt.android)
    ksp(libs.hilt.android.compiler)
    implementation(libs.androidx.startup.runtime)
    implementation(libs.coil.compose)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.activity.ktx)
    ksp(libs.androidx.hilt.compiler)

    implementation(platform(libs.firebase.bom))
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
}
