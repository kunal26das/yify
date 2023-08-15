package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import io.github.kunal26das.yify.domain.model.Movie

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MovieCard(
    modifier: Modifier = Modifier,
    movie: Movie,
    onClick: (Movie) -> Unit = {},
) {
    ElevatedCard(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        onClick = { onClick.invoke(movie) },
    ) {
        AsyncImage(
            modifier = Modifier.fillMaxSize(),
            contentDescription = movie.title,
            model = movie.coverImage,
            contentScale = ContentScale.Crop,
        )
    }
}