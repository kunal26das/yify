package io.github.kunal26das.yify.movies.compose

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshDefaults
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import io.github.kunal26das.common.compose.statusBarHeight
import io.github.kunal26das.yify.movies.domain.model.Movie

private const val LABEL = "vertical_grid_movies"

@Composable
@OptIn(ExperimentalMaterialApi::class)
fun VerticalGridMovies(
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues,
    moviePadding: PaddingValues,
    movies: LazyPagingItems<Movie>,
) {
    val refreshing = { movies.loadState.refresh is LoadState.Loading }
    val pullRefreshState = rememberPullRefreshState(
        refreshingOffset = PullRefreshDefaults.RefreshingOffset + statusBarHeight,
        refreshing = refreshing.invoke(),
        onRefresh = { movies.refresh() },
    )
    Box(modifier = Modifier.pullRefresh(pullRefreshState)) {
        AnimatedContent(
            modifier = modifier,
            targetState = movies,
            label = LABEL,
        ) { movies ->
            when (movies.itemCount) {
                0 -> when (movies.loadState.refresh) {
                    is LoadState.Error -> {
                        ErrorState(
                            modifier = Modifier.align(Alignment.Center),
                            movies = movies,
                        ) {
                            movies.refresh()
                        }
                    }

                    is LoadState.Loading -> Unit
                    is LoadState.NotLoading -> Unit
                }

                else -> NonEmptyState(
                    contentPadding = contentPadding,
                    moviePadding = moviePadding,
                    movies = movies,
                )
            }
        }
        PullRefreshIndicator(
            modifier = Modifier.align(Alignment.TopCenter),
            refreshing = refreshing.invoke(),
            state = pullRefreshState,
            scale = true,
        )
    }
}