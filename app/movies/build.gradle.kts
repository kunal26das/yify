plugins {
    kotlin("jvm")
    id("java-library")
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.kotlinSerialization)
}

java {
    sourceCompatibility = ProjectConfig.javaVersion
    targetCompatibility = ProjectConfig.javaVersion
}

dependencies {
    implementation(project(":app:movies:domain"))

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.ui.tooling)
    implementation(libs.androidx.compose.runtime)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.compose.material.icons.extended)

    implementation(libs.coil.compose)

    implementation(libs.paging.common)
    implementation(libs.paging.compose.common)

    implementation(libs.androidx.datastore)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.kotlinx.serialization.json)

    implementation(platform(libs.koin.bom))
    implementation(libs.koin.core)
    implementation(libs.koin.compose.viewmodel)

    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.serialization)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.client.logging)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.okhttp.dnsoverhttps)
}