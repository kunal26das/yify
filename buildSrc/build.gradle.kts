import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    `kotlin-dsl`
}

repositories {
    google()
    mavenCentral()
}

//noinspection UseTomlInstead
dependencies {
    val kotlinGradleVersion = "2.0.0" // check kotlinCompilerExtensionVersion before changing
    val kspVersion = "1.0.20"
    implementation("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinGradleVersion")
    implementation("com.android.tools.build:gradle:8.4.1")
    implementation("com.google.dagger:hilt-android-gradle-plugin:2.51.1")
    implementation("com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin:$kotlinGradleVersion-$kspVersion")
    implementation("org.jetbrains.kotlin:kotlin-serialization:$kotlinGradleVersion")
    implementation("com.google.gms:google-services:4.4.1")
    implementation("com.google.firebase:firebase-crashlytics-gradle:3.0.1")
    implementation("org.jetbrains.kotlinx:kotlinx-collections-immutable:0.3.7")
    implementation("com.google.firebase:perf-plugin:1.4.2")
    implementation("io.realm.kotlin:gradle-plugin:1.16.0")
}


val compileKotlin: KotlinCompile by tasks
compileKotlin.kotlinOptions {
    jvmTarget = "17"
}