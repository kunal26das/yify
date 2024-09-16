import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

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
    val kotlinVersion = "2.0.20"
    val kspVersion = "1.0.24"

    implementation("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")
    implementation("org.jetbrains.kotlin:kotlin-serialization:$kotlinVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-collections-immutable:0.3.8")

    implementation("com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin:$kotlinVersion-$kspVersion")
    implementation("com.google.dagger:hilt-android-gradle-plugin:2.52")
    implementation("com.google.gms:google-services:4.4.2")

    implementation("com.google.firebase:firebase-crashlytics-gradle:3.0.2")
    implementation("com.google.firebase:perf-plugin:1.4.2")

    implementation("com.android.tools.build:gradle:8.6.0")

    implementation("io.realm.kotlin:gradle-plugin:2.3.0")
}

val compileKotlin: KotlinCompile by tasks
compileKotlin.kotlinOptions {
    jvmTarget = "17"
}