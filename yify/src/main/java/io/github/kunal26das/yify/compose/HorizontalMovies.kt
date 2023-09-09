package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.paging.PagingData
import androidx.paging.compose.collectAsLazyPagingItems
import io.github.kunal26das.yify.domain.model.Movie
import kotlinx.coroutines.flow.Flow

@Composable
fun HorizontalMovies(
    modifier: Modifier = Modifier,
    moviesFlow: Flow<PagingData<Movie>>,
    onClick: (Movie?) -> Unit = {},
) {
    val movies = moviesFlow.collectAsLazyPagingItems()
    LazyRow(
        modifier = modifier,
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
}