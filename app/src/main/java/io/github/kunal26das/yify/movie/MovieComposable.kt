package io.github.kunal26das.yify.movie

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import coil.compose.AsyncImage
import io.github.kunal26das.model.Movie

@OptIn(ExperimentalMaterial3Api::class)
interface MovieComposable {

    @Composable
    fun MovieCard(
        modifier: Modifier = Modifier,
        movie: Movie?,
        onClick: (() -> Unit) = { },
    ) {
        ElevatedCard(
            modifier = modifier,
            onClick = onClick,
        ) {
            AsyncImage(
                modifier = Modifier.fillMaxSize(),
                contentDescription = movie?.title,
                model = movie?.coverImage,
            )
        }
    }

}