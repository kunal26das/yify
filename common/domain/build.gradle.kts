plugins {
    kotlin("jvm")
    id("java-library")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")
    implementation("androidx.annotation:annotation-jvm:1.7.1")
}