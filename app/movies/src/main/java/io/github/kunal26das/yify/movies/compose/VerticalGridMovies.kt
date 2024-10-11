package io.github.kunal26das.yify.movies.compose

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshDefaults
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import io.github.kunal26das.common.compose.LocalStatusBarHeight
import io.github.kunal26das.yify.movies.domain.model.Movie

private const val LABEL = "vertical_grid_movies"

@Composable
@OptIn(ExperimentalMaterialApi::class)
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
    val pullRefreshState = rememberPullRefreshState(
        refreshingOffset = PullRefreshDefaults.RefreshingOffset + LocalStatusBarHeight.current,
        onRefresh = movies::refresh,
        refreshing = isRefreshing,
    )
    Box(modifier = Modifier.pullRefresh(pullRefreshState)) {
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
        PullRefreshIndicator(
            modifier = Modifier.align(Alignment.TopCenter),
            refreshing = isRefreshing,
            state = pullRefreshState,
            scale = true,
        )
    }
}