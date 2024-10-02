plugins {
    `kotlin-dsl`
}

repositories {
    google()
    mavenCentral()
    maven { setUrl("https://plugins.gradle.org/m2/") }
}

// noinspection UseTomlInstead
dependencies {
    implementation("com.android.tools.build:gradle:8.7.0")
    implementation("com.squareup:javapoet:1.13.0")
}