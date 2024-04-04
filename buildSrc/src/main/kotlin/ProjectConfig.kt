import org.gradle.api.JavaVersion

object ProjectConfig {
    const val applicationId = "io.github.kunal26das.yify"
    const val minSdk = 33
    const val targetSdk = 34
    const val compileSdk = 34
    const val versionCode = 4
    const val versionName = versionCode.toString()
    val javaVersion = JavaVersion.VERSION_17
}