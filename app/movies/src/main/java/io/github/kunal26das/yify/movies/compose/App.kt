package io.github.kunal26das.yify.movies.compose

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import io.github.kunal26das.common.compose.Theme
import io.github.kunal26das.yify.movies.domain.model.Genre
import io.github.kunal26das.yify.movies.domain.model.Language
import io.github.kunal26das.yify.movies.domain.model.Movie
import io.github.kunal26das.yify.movies.domain.model.Quality
import io.github.kunal26das.yify.movies.presentation.Destination
import io.github.kunal26das.yify.movies.presentation.MovieNavType
import kotlin.reflect.typeOf

@Composable
fun App(
    modifier: Modifier = Modifier,
) {
    val navHostController = rememberNavController()
    Theme(
        navHostController = navHostController
    ) {
        NavHost(
            modifier = modifier,
            navController = navHostController,
            startDestination = Destination.Movies,
        ) {
            composable<Destination.Movies> {
                Movies(
                    modifier = modifier,
                )
            }
            composable<Destination.MovieDetails>(
                typeMap = mapOf(
                    typeOf<Movie>() to MovieNavType,
                    typeOf<Genre>() to NavType.EnumType(Genre::class.java),
                    typeOf<Quality>() to NavType.EnumType(Quality::class.java),
                    typeOf<Language>() to NavType.EnumType(Language::class.java),
                )
            ) {
                val details = it.toRoute<Destination.MovieDetails>()
                MovieDialog(
                    modifier = modifier,
                    movie = details.movie,
                )
            }
        }
    }
}