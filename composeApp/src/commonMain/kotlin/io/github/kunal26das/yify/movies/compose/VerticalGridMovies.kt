package io.github.kunal26das.yify.movies.compose

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import io.github.kunal26das.yify.movies.domain.model.Movie

private const val LABEL = "vertical_grid_movies"

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun VerticalGridMovies(
    modifier: Modifier = Modifier,
    state: LazyGridState = rememberLazyGridState(),
    contentPadding: PaddingValues,
    moviePadding: PaddingValues,
    movies: LazyPagingItems<Movie>,
) {
    val isRefreshing by remember {
        derivedStateOf {
            movies.loadState.refresh is LoadState.Loading
                    || movies.loadState.append is LoadState.Loading
                    || movies.loadState.prepend is LoadState.Loading
        }
    }
    val pullRefreshState = rememberPullToRefreshState()
    PullToRefreshBox(
        modifier = modifier,
        isRefreshing = isRefreshing,
        onRefresh = movies::refresh,
        state = pullRefreshState,
    ) {
        AnimatedContent(
            modifier = modifier,
            targetState = movies,
            label = LABEL,
        ) { movies ->
            if (movies.itemCount == 0
                && movies.loadState.hasError
            ) {
                ErrorState(
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                NonEmptyState(
                    state = state,
                    contentPadding = contentPadding,
                    moviePadding = moviePadding,
                    movies = movies,
                )
            }
        }
    }
}