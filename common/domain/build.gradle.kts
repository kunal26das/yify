plugins {
    kotlin("jvm")
    id("java-library")
    kotlin("plugin.serialization")
}

kotlinModule()

dependencies {
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.datastore.core)
}