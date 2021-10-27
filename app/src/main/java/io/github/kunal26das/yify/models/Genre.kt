package io.github.kunal26das.yify.models

import androidx.annotation.StringDef
import io.github.kunal26das.yify.models.Genre.Companion.GENRE_ALL

@StringDef(
    GENRE_ALL,
)
annotation class Genre {
    companion object {
        const val GENRE_ALL = "All"
    }
}