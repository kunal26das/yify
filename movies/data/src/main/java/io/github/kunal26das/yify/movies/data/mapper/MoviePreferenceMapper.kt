package io.github.kunal26das.yify.movies.data.mapper

import io.github.kunal26das.yify.movies.data.preference.MoviePreferenceDto
import io.github.kunal26das.yify.movies.domain.model.Genre
import io.github.kunal26das.yify.movies.domain.model.OrderBy
import io.github.kunal26das.yify.movies.domain.model.Quality
import io.github.kunal26das.yify.movies.domain.model.SortBy
import io.github.kunal26das.yify.movies.domain.preference.MoviePreference

fun MoviePreferenceDto.toMoviePreference(): MoviePreference {
    return MoviePreference(
        quality = Quality[quality] ?: Quality.High,
        minimumRating = minimumRating ?: 0,
        queryTerm = queryTerm.orEmpty(),
        genre = Genre[genre],
        sortBy = SortBy[sortBy] ?: SortBy.DateAdded,
        orderBy = OrderBy[orderBy] ?: OrderBy.Descending,
    )
}

fun MoviePreference.toMoviePreferenceDto(): MoviePreferenceDto {
    return MoviePreferenceDto(
        quality = quality.value,
        minimumRating = minimumRating,
        queryTerm = queryTerm,
        genre = genre?.name,
        sortBy = sortBy.name,
        orderBy = orderBy.name,
    )
}