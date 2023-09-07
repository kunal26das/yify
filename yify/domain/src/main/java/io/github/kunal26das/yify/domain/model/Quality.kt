package io.github.kunal26das.yify.domain.model


@Suppress("ClassName")
sealed class Quality(val value: String, val name: String) {
    data object `720p` : Quality(QUALITY_720p, "720p")
    data object `1080p` : Quality(QUALITY_1080p, "1080p")
    data object `4k` : Quality(QUALITY_2160p, "4k")
    data object `3D` : Quality(QUALITY_3D, "3D")
    data object Unknown : Quality("", "Unknown")

    companion object : HashMap<String, Quality>(
        Quality::class.sealedSubclasses
            .mapNotNull {
                it.objectInstance
            }.filter {
                it != Unknown
            }.associateBy {
                it.value
            }
    ) {

        private const val QUALITY_720p = "720p"
        private const val QUALITY_1080p = "1080p"
        private const val QUALITY_2160p = "2160p"
        private const val QUALITY_3D = "3D"

        val ALL get() = values
    }
}