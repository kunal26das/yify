package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.paging.PagingData
import androidx.paging.compose.collectAsLazyPagingItems
import io.github.kunal26das.yify.domain.model.Movie
import kotlinx.coroutines.flow.Flow

@Composable
fun Movies(
    modifier: Modifier = Modifier,
    source: Flow<PagingData<Movie>>,
    onClick: (Movie?) -> Unit = {},
) {
    val movies = source.collectAsLazyPagingItems()
    LazyVerticalStaggeredGrid(
        modifier = modifier,
        columns = StaggeredGridCells.Adaptive(300.dp),
        contentPadding = PaddingValues(8.dp),
        content = {
            items(movies.itemCount) { index ->
                val movie = movies[index]
                if (movie != null) {
                    MovieCard(
                        modifier = Modifier.padding(8.dp),
                        movie = movie,
                        onClick = onClick,
                    )
                }
            }
        }
    )
}