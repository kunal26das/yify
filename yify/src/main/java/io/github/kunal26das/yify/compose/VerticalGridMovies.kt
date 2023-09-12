package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.height
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
import androidx.paging.LoadState
import androidx.paging.PagingData
import androidx.paging.compose.collectAsLazyPagingItems
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.domain.model.Movie
import kotlinx.coroutines.flow.Flow

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun VerticalGridMovies(
    modifier: Modifier = Modifier,
    moviesFlow: Flow<PagingData<Movie>>,
    onClick: (Movie?) -> Unit = {},
) {
    var refreshing by remember { mutableStateOf(false) }
    val movies = moviesFlow.collectAsLazyPagingItems()
    val pullRefreshState = rememberPullRefreshState(
        refreshing = refreshing,
        onRefresh = {
            refreshing = true
            movies.refresh()
            refreshing = false
        },
    )
    Box(
        modifier = modifier
            .pullRefresh(pullRefreshState),
    ) {
        LazyVerticalGrid(
            columns = GridCells.Adaptive(Constants.movieWidth),
            contentPadding = PaddingValues(8.dp),
            content = {
                items(movies.itemCount) { index ->
                    val movie = movies[index]
                    MovieCard(
                        modifier = Modifier
                            .height(Constants.movieHeight)
                            .padding(8.dp),
                        movie = movie,
                        onClick = onClick,
                    )
                }
                if (movies.loadState.append is LoadState.Loading) {
                    items(Constants.LOAD_SIZE) {
                        MovieCard(
                            modifier = Modifier
                                .height(Constants.movieHeight)
                                .padding(8.dp),
                        )
                    }
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