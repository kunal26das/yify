package io.github.kunal26das.yify.compose

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshDefaults
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import io.github.kunal26das.common.compose.statusBarHeight
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.ui.MovieActivity

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
    ) { categorisedMovies ->
        Box(modifier = Modifier.fillMaxSize()) {
            LazyColumn(
                contentPadding = PaddingValues(
                    bottom = statusBarHeight,
                    top = statusBarHeight,
                ),
                content = {
                    itemsIndexed(categorisedMovies) { index, movies ->
                        AnimatedVisibility(movies.itemCount != 0) {
                            MovieCategory(
                                genre = genres[index],
                                movies = movies,
                            )
                        }
                    }
                }
            )
            PullRefreshIndicator(
                modifier = Modifier.align(Alignment.TopCenter),
                refreshing = categorisedMovies.any { it.loadState.refresh == LoadState.Loading },
                state = pullRefreshState,
                scale = true,
            )
        }
    }
}

@Composable
private fun MovieCategory(
    genre: Genre,
    movies: LazyPagingItems<Movie>,
) {
    val movieActivity = rememberLauncherForActivityResult(
        contract = MovieActivity.Contract(),
        onResult = {}
    )
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            modifier = Modifier.padding(
                start = 14.dp,
                top = 13.dp,
                end = 16.dp,
                bottom = 3.dp,
            ),
            text = genre.name,
            color = MaterialTheme.colorScheme.onSurface,
            fontSize = 16.sp,
        )
        HorizontalMovies(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 8.dp),
            moviePadding = PaddingValues(4.dp),
            movies = movies,
        ) {
            movieActivity.launch(it?.id)
        }
    }
}