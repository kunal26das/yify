plugins {
    kotlin("jvm")
    id("java-library")
    id("com.google.devtools.ksp")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    implementation(project(":yify:domain"))
    implementation(project(":common:domain"))

    implementation(libs.gson)
    implementation(libs.retrofit)
    implementation(libs.hilt.core)
    implementation(libs.androidx.paging.common.ktx)
    ksp(libs.hilt.compiler)
    implementation(libs.kotlinx.coroutines.core)
}