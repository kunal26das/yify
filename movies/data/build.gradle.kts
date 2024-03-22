plugins {
    kotlin("jvm")
    id("java-library")
    id("com.google.devtools.ksp")
    kotlin("plugin.serialization")
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