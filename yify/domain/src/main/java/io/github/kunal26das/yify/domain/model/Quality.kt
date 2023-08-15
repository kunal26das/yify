package io.github.kunal26das.yify.domain.model

import androidx.annotation.StringDef
import io.github.kunal26das.yify.domain.model.Quality.Companion.QUALITY_1080p
import io.github.kunal26das.yify.domain.model.Quality.Companion.QUALITY_2160p
import io.github.kunal26das.yify.domain.model.Quality.Companion.QUALITY_3D
import io.github.kunal26das.yify.domain.model.Quality.Companion.QUALITY_720p
import io.github.kunal26das.yify.domain.model.Quality.Companion.QUALITY_ALL

@StringDef(
    QUALITY_ALL,
    QUALITY_720p,
    QUALITY_1080p,
    QUALITY_2160p,
    QUALITY_3D,
)
annotation class Quality {
    companion object : ArrayList<String>() {

        const val QUALITY_ALL = "All"
        const val QUALITY_720p = "720p"
        const val QUALITY_1080p = "1080p"
        const val QUALITY_2160p = "2160p"
        const val QUALITY_3D = "3D"

        init {
            add(QUALITY_ALL)
            add(QUALITY_720p)
            add(QUALITY_1080p)
            add(QUALITY_2160p)
            add(QUALITY_3D)
        }
    }
}