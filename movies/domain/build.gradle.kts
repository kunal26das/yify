plugins {
    kotlin("jvm")
    id("java-library")
}

kotlinModule()

dependencies {
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.androidx.paging.common.ktx)
}
