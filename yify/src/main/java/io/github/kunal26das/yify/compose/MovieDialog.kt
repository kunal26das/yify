package io.github.kunal26das.yify.compose

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import io.github.kunal26das.yify.domain.model.Movie

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun MovieDialog(
    movie: Movie?,
    onDismissRequest: () -> Unit = {},
) {
    AlertDialog(
        onDismissRequest = onDismissRequest,
        content = {
            AsyncImage(
                modifier = Modifier.fillMaxSize(),
                contentDescription = movie?.slug,
                model = movie?.coverImageUrl,
                contentScale = ContentScale.FillWidth,
            )
        },
    )
}