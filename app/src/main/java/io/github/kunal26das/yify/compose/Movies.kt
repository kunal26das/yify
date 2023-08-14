package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp
import androidx.paging.PagingData
import androidx.paging.compose.collectAsLazyPagingItems
import io.github.kunal26das.yify.model.Movie
import kotlinx.coroutines.flow.Flow

@Composable
fun Movies(
    modifier: Modifier = Modifier,
    source: Flow<PagingData<Movie>>? = null,
    onClick: (Movie?) -> Unit = {},
) {
    val movies = source?.collectAsLazyPagingItems()
    val columns = columns(LocalConfiguration.current.screenWidthDp)
    LazyVerticalGrid(
        modifier = modifier.fillMaxSize(),
        columns = GridCells.Fixed(columns),
        content = {
            items(movies?.itemCount ?: 0) { index ->
                val movie = movies?.get(index)
                MovieCard(
                    modifier = Modifier.padding(8.dp),
                    movie = movie,
                    onClick = onClick,
                )
            }
        }
    )
}

private fun columns(screenWidthDp: Int): Int {
    return screenWidthDp / 300 + 1
}