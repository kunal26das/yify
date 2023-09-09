package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.paging.PagingData
import androidx.paging.compose.collectAsLazyPagingItems
import io.github.kunal26das.yify.Constants
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
        contentPadding = PaddingValues(horizontal = 8.dp),
        content = {
            items(movies.itemCount) { index ->
                val movie = movies[index]
                MovieCard(
                    modifier = Modifier
                        .width(Constants.MOVIE_WIDTH.dp)
                        .height(Constants.MOVIE_HEIGHT.dp)
                        .padding(8.dp),
                    movie = movie,
                    onClick = onClick,
                )
            }
            items(Constants.LOAD_SIZE) {
                MovieCard(
                    modifier = Modifier
                        .width(Constants.MOVIE_WIDTH.dp)
                        .height(Constants.MOVIE_HEIGHT.dp)
                        .padding(8.dp),
                )
            }
        }
    )
}