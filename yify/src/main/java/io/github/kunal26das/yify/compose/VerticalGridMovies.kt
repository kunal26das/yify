package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.Text
import androidx.compose.material.pullrefresh.PullRefreshDefaults
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.paging.LoadState
import androidx.paging.PagingData
import androidx.paging.compose.collectAsLazyPagingItems
import io.github.kunal26das.common.compose.statusBarHeight
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.domain.model.Movie
import kotlinx.coroutines.flow.Flow

@Composable
@OptIn(ExperimentalMaterialApi::class)
fun VerticalGridMovies(
    modifier: Modifier = Modifier,
    moviesFlow: Flow<PagingData<Movie>>,
    onClick: (Movie?) -> Unit = {},
) {
    val movies = moviesFlow.collectAsLazyPagingItems()
    val pullRefreshState = rememberPullRefreshState(
        refreshing = movies.loadState.refresh is LoadState.Loading,
        onRefresh = { movies.refresh() },
        refreshingOffset = PullRefreshDefaults.RefreshingOffset + statusBarHeight,
    )
    Box(
        modifier = modifier
            .pullRefresh(pullRefreshState),
    ) {
        when (movies.itemCount) {
            0 -> {
                if (movies.loadState.refresh !is LoadState.Loading) {
                    Text(
                        modifier = Modifier.align(Alignment.Center),
                        text = when (movies.loadState.refresh) {
                            is LoadState.Error -> {
                                val error = (movies.loadState.refresh as LoadState.Error)
                                error.error.message.toString()
                            }

                            else -> stringResource(R.string.no_movies_found)
                        },
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontSize = 20.sp,
                    )
                }
            }

            else -> LazyVerticalGrid(
                columns = GridCells.Adaptive(Constants.movieWidth),
                contentPadding = PaddingValues(
                    start = 8.dp,
                    top = statusBarHeight,
                    end = 8.dp,
                    bottom = statusBarHeight,
                ),
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
        }
        PullRefreshIndicator(
            modifier = Modifier.align(Alignment.TopCenter),
            refreshing = movies.loadState.refresh is LoadState.Loading,
            state = pullRefreshState,
            scale = true,
        )
    }
}