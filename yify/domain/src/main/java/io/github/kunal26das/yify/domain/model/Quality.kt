package io.github.kunal26das.yify.domain.model

@Suppress("ClassName")
sealed class Quality(val name: String) {
    data object `720p` : Quality(QUALITY_720p)
    data object `1080p` : Quality(QUALITY_1080p)
    data object `4k` : Quality(QUALITY_2160p)
    data object `3D` : Quality(QUALITY_3D)
    internal data object Unknown : Quality("")

    companion object {

        private const val QUALITY_720p = "720p"
        private const val QUALITY_1080p = "1080p"
        private const val QUALITY_2160p = "2160p"
        private const val QUALITY_3D = "3D"

        operator fun get(quality: String?) = when (quality) {
            QUALITY_720p -> `720p`
            QUALITY_1080p -> `1080p`
            QUALITY_2160p -> `4k`
            QUALITY_3D -> `3D`
            else -> Unknown
        }
    }
}