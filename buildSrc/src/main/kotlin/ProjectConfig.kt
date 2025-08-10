import org.gradle.api.JavaVersion

object ProjectConfig {
    const val applicationId = "io.github.kunal26das.yify"
    const val minSdk = 33
    const val targetSdk = 36
    const val compileSdk = 36
    const val versionCode = 17
    const val versionName = versionCode.toString()
    val javaVersion = JavaVersion.VERSION_21
}