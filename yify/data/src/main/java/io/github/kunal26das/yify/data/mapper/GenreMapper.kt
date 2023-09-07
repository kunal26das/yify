package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.domain.model.Genre

val List<String>?.toGenres: List<Genre>
    get() = this?.mapNotNull { Genre[it] } ?: emptyList()