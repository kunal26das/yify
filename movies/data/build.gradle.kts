plugins {
    kotlin("jvm")
    id("java-library")
    alias(libs.plugins.ksp)
    alias(libs.plugins.kotlinSerialization)
}

kotlinModule()

dependencies {
    implementation(project(":common:domain"))
    implementation(project(":movies:domain"))

    implementation(libs.ktor.client.core)

    implementation(libs.hilt.core)
    ksp(libs.hilt.compiler)

    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.androidx.datastore.core)
    implementation(libs.androidx.paging.common.ktx)
}