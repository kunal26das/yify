package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.data.model.CastModel
import io.github.kunal26das.yify.domain.model.Cast

val CastModel.toCast: Cast
    get() = Cast(
        imdbCode = imdbCode,
        characterName = characterName.orEmpty(),
        name = name.orEmpty(),
        imageUrl = urlSmallImage,
    )

val List<CastModel>?.toCast: List<Cast>
    get() = this?.map { it.toCast } ?: emptyList()