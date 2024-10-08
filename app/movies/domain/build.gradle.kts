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
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.androidx.paging.common.ktx)
    implementation(libs.kotlinx.serialization.json)
}
