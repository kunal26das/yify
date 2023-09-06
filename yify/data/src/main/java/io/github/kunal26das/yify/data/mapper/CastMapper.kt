package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.data.dto.CastDto
import io.github.kunal26das.yify.domain.model.Cast

val CastDto.toCast: Cast
    get() = Cast(
        imdbCode = imdbCode,
        characterName = characterName.orEmpty(),
        name = name.orEmpty(),
        imageUrl = urlSmallImage,
    )

val List<CastDto>?.toCast: List<Cast>
    get() = this?.map { it.toCast } ?: emptyList()