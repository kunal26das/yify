package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.paging.compose.collectAsLazyPagingItems
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.ui.MoviesViewModel

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun Movies(
    modifier: Modifier = Modifier,
    moviesViewModel: MoviesViewModel = hiltViewModel(),
    onClick: (Movie?) -> Unit = {},
) {
    val movies = moviesViewModel.movies.collectAsLazyPagingItems()
    var refreshing by remember { mutableStateOf(false) }
    val pullRefreshState = rememberPullRefreshState(
        onRefresh = {
            refreshing = true
            movies.refresh()
            refreshing = false
        },
        refreshing = refreshing,
    )
    Box(
        modifier = modifier
            .pullRefresh(pullRefreshState),
    ) {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(300.dp),
            contentPadding = PaddingValues(8.dp),
            content = {
                items(movies.itemCount) { index ->
                    val movie = movies[index]
                    MovieCard(
                        modifier = Modifier.padding(8.dp),
                        movie = movie,
                        onClick = onClick,
                    )
                }
            }
        )
        PullRefreshIndicator(
            modifier = Modifier.align(Alignment.TopCenter),
            refreshing = refreshing,
            state = pullRefreshState,
        )
    }
}