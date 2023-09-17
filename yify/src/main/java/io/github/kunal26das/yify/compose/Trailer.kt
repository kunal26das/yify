package io.github.kunal26das.yify.compose

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
@OptIn(ExperimentalMaterial3Api::class)
fun TrailerPlayer(
    modifier: Modifier = Modifier,
    movie: Movie?,
    player: Player,
) {
    var visible by remember { mutableStateOf(true) }
    var clicked by remember { mutableStateOf(false) }
    AnimatedVisibility(
        modifier = modifier.aspectRatio(Constants.TRAILER_ASPECT_RATIO),
        visible = visible,
    ) {
        ElevatedCard(
            modifier = Modifier.fillMaxSize(),
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
    AsyncImage(
        modifier = modifier.clickable {
            onClick.invoke()
        },
        model = url?.imageRequest,
        contentDescription = url,
        contentScale = ContentScale.Crop,
        onState = onStateChange,
    )
}