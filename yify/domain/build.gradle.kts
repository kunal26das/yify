plugins {
    id("java-library")
    kotlin("jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    implementation("androidx.annotation:annotation-jvm:1.6.0")
    implementation("androidx.room:room-common:2.5.2")
    implementation(kotlin("reflect"))
}
