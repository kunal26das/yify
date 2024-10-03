package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import io.github.kunal26das.yify.movies.Constants
import io.github.kunal26das.yify.movies.domain.model.Movie

@Composable
fun NonEmptyState(
    modifier: Modifier = Modifier,
    state: LazyGridState = rememberLazyGridState(),
    contentPadding: PaddingValues,
    moviePadding: PaddingValues,
    movies: LazyPagingItems<Movie>,
) {
    LazyVerticalGrid(
        modifier = modifier,
        state = state,
        contentPadding = contentPadding,
        columns = GridCells.Adaptive(Constants.movieWidth),
        content = {
            items(movies.itemCount) { index ->
                val movie = movies[index]
                MovieCard(
                    modifier = Modifier
                        .aspectRatio(Constants.MOVIE_ASPECT_RATIO)
                        .padding(moviePadding),
                    movie = movie,
                )
            }
            if (movies.loadState.append is LoadState.Error) {
                movies.refresh()
            }
        }
    )
}