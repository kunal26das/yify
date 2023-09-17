package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.paging.LoadState
import androidx.paging.PagingData
import androidx.paging.compose.LazyPagingItems
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
        modifier = modifier.pullRefresh(pullRefreshState),
    ) {
        when (movies.itemCount) {
            0 -> when (movies.loadState.refresh) {
                !is LoadState.Loading -> {
                    EmptyState(
                        modifier = Modifier.Companion.align(Alignment.Center),
                        movies = movies,
                    ) {
                        movies.refresh()
                    }
                }

                else -> Unit
            }

            else -> NonEmptyState(movies, onClick)
        }
        PullRefreshIndicator(
            modifier = Modifier.align(Alignment.TopCenter),
            refreshing = movies.loadState.refresh is LoadState.Loading,
            state = pullRefreshState,
            scale = true,
        )
    }
}

@Composable
private fun NonEmptyState(
    movies: LazyPagingItems<Movie>,
    onClick: (Movie?) -> Unit
) {
    LazyVerticalGrid(
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
                        .aspectRatio(Constants.MOVIE_ASPECT_RATIO)
                        .padding(8.dp),
                    movie = movie,
                    onClick = onClick,
                )
            }
            if (movies.loadState.append is LoadState.Loading) {
                items(Constants.LOAD_SIZE) {
                    MovieCard(
                        modifier = Modifier
                            .aspectRatio(Constants.MOVIE_ASPECT_RATIO)
                            .padding(8.dp),
                    )
                }
            }
        }
    )
}

@Composable
private fun EmptyState(
    modifier: Modifier = Modifier,
    movies: LazyPagingItems<Movie>,
    onRefresh: () -> Unit = {},
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
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

        OutlinedButton(
            modifier = Modifier.padding(top = 8.dp),
            onClick = onRefresh,
            content = { Text(text = stringResource(R.string.clear)) }
        )
    }
}