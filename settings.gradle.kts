pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "yify"
include(":androidApp")
include(":di")
include(":common")
include(":common:domain")
include(":movies")
include(":movies:data")
include(":movies:domain")
include(":shared")
