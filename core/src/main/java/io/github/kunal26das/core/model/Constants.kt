package io.github.kunal26das.core.model

import androidx.annotation.StringDef
import io.github.kunal26das.core.model.Constants.Companion.BASE_URL_YIFY

@StringDef(
    BASE_URL_YIFY,
)
annotation class Constants {
    companion object {
        const val BASE_URL_YIFY = "base_url_yify"
    }
}