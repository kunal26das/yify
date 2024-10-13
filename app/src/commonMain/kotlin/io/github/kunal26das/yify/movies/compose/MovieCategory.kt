package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.paging.compose.LazyPagingItems
import io.github.kunal26das.yify.movies.domain.model.Movie

@Composable
fun MovieCategory(
    category: String,
    movies: LazyPagingItems<Movie>,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            modifier = Modifier.padding(
                start = 14.dp,
                top = 13.dp,
                end = 16.dp,
                bottom = 3.dp,
            ),
            text = category,
            color = MaterialTheme.colorScheme.onSurface,
            fontSize = 16.sp,
        )
        HorizontalMovies(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 8.dp),
            moviePadding = PaddingValues(4.dp),
            movies = movies,
        )
    }
}