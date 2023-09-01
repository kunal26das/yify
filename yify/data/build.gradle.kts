plugins {
    id("java-library")
    id("kotlin-kapt")
    kotlin("jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    implementation(project(":yify:domain"))
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("androidx.annotation:annotation-jvm:1.6.0")
    implementation("com.google.dagger:hilt-core:2.48")
    kapt("com.google.dagger:hilt-compiler:2.47")
}