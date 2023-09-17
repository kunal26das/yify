package io.github.kunal26das.yify.compose

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import coil.compose.AsyncImage
import coil.compose.AsyncImagePainter
import io.github.kunal26das.yify.Constants
import io.github.kunal26das.yify.domain.model.Movie

@Composable
fun TrailerCard(
    modifier: Modifier = Modifier,
    movie: Movie?,
    player: Player,
) {
    var visible by remember { mutableStateOf(true) }
    var clicked by remember { mutableStateOf(false) }
    if (visible) {
        ElevatedCard(
            modifier = modifier
                .aspectRatio(Constants.TRAILER_ASPECT_RATIO)
                .fillMaxSize(),
            shape = RoundedCornerShape(8.dp),
        ) {
            Box {
                Player(
                    modifier = Modifier.fillMaxSize(),
                    player = player
                )
                if (clicked.not()) {
                    Trailer(
                        modifier = Modifier.fillMaxSize(),
                        url = movie?.trailerImageUrl,
                        onStateChange = {
                            if (it is AsyncImagePainter.State.Error) {
                                visible = movie?.youtubeTrailerUrl.isNullOrEmpty().not()
                            }
                        },
                        onClick = {
                            movie?.youtubeTrailerUrl?.let {
                                val mediaItem = MediaItem.fromUri(it)
                                player.setMediaItem(mediaItem)
                                clicked = true
                                player.play()
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun Trailer(
    modifier: Modifier = Modifier,
    url: String?,
    onStateChange: (AsyncImagePainter.State) -> Unit = {},
    onClick: () -> Unit = {},
) {
    var state by remember { mutableStateOf<AsyncImagePainter.State>(AsyncImagePainter.State.Empty) }
    Box(
        modifier = modifier,
    ) {
        AsyncImage(
            modifier = Modifier
                .fillMaxSize()
                .clickable {
                    onClick.invoke()
                },
            model = url?.imageRequest,
            contentDescription = url,
            contentScale = ContentScale.Crop,
            onState = {
                onStateChange.invoke(it)
                state = it
            },
        )
        when (state) {
            is AsyncImagePainter.State.Loading -> {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                )
            }

            else -> Unit
        }
    }
}