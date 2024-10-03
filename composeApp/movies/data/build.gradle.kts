plugins {
    kotlin("jvm")
    id("java-library")
    alias(libs.plugins.ksp)
    alias(libs.plugins.kotlinSerialization)
}

kotlinModule()

dependencies {
    implementation(project(":composeApp:common:domain"))
    implementation(project(":composeApp:movies:domain"))

    implementation(libs.ktor.client.core)

    implementation(libs.hilt.core)
    ksp(libs.hilt.compiler)

    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.androidx.datastore.core)
    implementation(libs.androidx.paging.common.ktx)
}