package io.github.kunal26das.yify.compose

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshDefaults
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import io.github.kunal26das.common.compose.statusBarHeight
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Movie

private const val LABEL = "categorized_movies"

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun CategorisedMovies(
    modifier: Modifier = Modifier,
    genres: List<Genre>,
    categorisedMovies: List<LazyPagingItems<Movie>>,
    onRefresh: () -> Unit = {},
) {
    val pullRefreshState = rememberPullRefreshState(
        refreshing = categorisedMovies.any { it.loadState.refresh == LoadState.Loading },
        refreshingOffset = PullRefreshDefaults.RefreshingOffset + statusBarHeight,
        onRefresh = onRefresh,
    )
    AnimatedContent(
        modifier = modifier,
        targetState = categorisedMovies,
        label = LABEL,
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            LazyColumn(
                contentPadding = PaddingValues(
                    bottom = statusBarHeight,
                    top = statusBarHeight,
                ),
                content = {
                    itemsIndexed(it) { index, movies ->
                        AnimatedVisibility(movies.itemCount != 0) {
                            MovieCategory(
                                category = genres[index].name,
                                movies = movies,
                            )
                        }
                    }
                }
            )
            PullRefreshIndicator(
                modifier = Modifier.align(Alignment.TopCenter),
                refreshing = it.any { it.loadState.refresh == LoadState.Loading },
                state = pullRefreshState,
                scale = true,
            )
        }
    }
}