plugins {
    kotlin("jvm")
    id("java-library")
    alias(libs.plugins.kotlinSerialization)
}

kotlinModule()

dependencies {
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.datastore.core)
}