plugins {
    id("java-library")
    id("com.google.devtools.ksp")
    kotlin("jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    implementation(project(":yify:domain"))
    implementation(project(mapOf("path" to ":common:domain")))
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("androidx.annotation:annotation-jvm:1.7.0")
    implementation("com.google.dagger:hilt-core:2.49")
    implementation("androidx.paging:paging-common-ktx:3.2.1")
    ksp("com.google.dagger:hilt-compiler:2.49")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
}