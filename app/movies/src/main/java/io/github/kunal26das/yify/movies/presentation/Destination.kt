package io.github.kunal26das.yify.movies.presentation

import io.github.kunal26das.yify.movies.domain.model.Movie
import kotlinx.serialization.Serializable


sealed interface Destination {
    @Serializable
    data object Movies : Destination

    @Serializable
    data class MovieDetails(
        val movie: Movie
    ) : Destination
}