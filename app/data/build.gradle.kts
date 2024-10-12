plugins {
    kotlin("jvm")
    id("java-library")
    alias(libs.plugins.kotlinSerialization)
}

java {
    sourceCompatibility = ProjectConfig.javaVersion
    targetCompatibility = ProjectConfig.javaVersion
}

dependencies {
    implementation(project(":app:domain"))

    implementation(libs.ktor.client.core)

    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.androidx.datastore.core)
    implementation(libs.paging.common)

    implementation(platform(libs.koin.bom))
    implementation(libs.koin.core)
}