package io.github.kunal26das.yify.compose

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.paging.LoadState
import androidx.paging.PagingData
import androidx.paging.compose.collectAsLazyPagingItems
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.domain.model.Movie
import kotlinx.coroutines.flow.Flow

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HorizontalMovies(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues,
    moviePadding: PaddingValues,
    moviesFlow: Flow<PagingData<Movie>>,
    onClick: (Movie?) -> Unit = {},
) {
    val state = rememberLazyListState()
    val movies = moviesFlow.collectAsLazyPagingItems()
    val snapFlingBehavior = rememberSnapFlingBehavior(lazyListState = state)
    LazyRow(
        modifier = modifier,
        state = state,
        contentPadding = contentPadding,
        flingBehavior = snapFlingBehavior,
        content = {
            items(movies.itemCount) { index ->
                val movie = movies[index]
                MovieCard(
                    modifier = Modifier
                        .width(Constants.movieWidth)
                        .aspectRatio(Constants.MOVIE_ASPECT_RATIO)
                        .padding(moviePadding),
                    movie = movie,
                    onClick = onClick,
                )
            }
            if (movies.itemCount == 0
                || movies.loadState.append is LoadState.Loading
            ) {
                items(Constants.LOAD_SIZE) {
                    MovieCard(
                        modifier = Modifier
                            .width(Constants.movieWidth)
                            .aspectRatio(Constants.MOVIE_ASPECT_RATIO)
                            .padding(moviePadding),
                    )
                }
            }
        }
    )
}