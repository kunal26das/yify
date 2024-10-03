plugins {
    kotlin("jvm")
    id("java-library")
    alias(libs.plugins.ksp)
    alias(libs.plugins.kotlinSerialization)
}

java {
    sourceCompatibility = ProjectConfig.javaVersion
    targetCompatibility = ProjectConfig.javaVersion
}

dependencies {
    implementation(project(":app:common:domain"))
    implementation(project(":app:movies:domain"))

    implementation(libs.ktor.client.core)

    implementation(libs.hilt.core)
    ksp(libs.hilt.compiler)

    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.androidx.datastore.core)
    implementation(libs.androidx.paging.common.ktx)
}