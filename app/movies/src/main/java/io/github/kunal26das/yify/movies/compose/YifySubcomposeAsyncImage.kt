package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import coil3.compose.AsyncImagePainter
import coil3.compose.LocalPlatformContext
import coil3.compose.SubcomposeAsyncImage
import coil3.request.ImageRequest
import coil3.request.crossfade

@Composable
fun YifySubcomposeAsyncImage(
    modifier: Modifier = Modifier,
    key: Any? = null,
    enableShimmer: Boolean = true,
    colorFilter: ColorFilter? = null,
    contentDescription: String? = null,
    contentScale: ContentScale = ContentScale.Crop,
    builder: ImageRequest.Builder.() -> Unit = {},
    onState: (AsyncImagePainter.State) -> Unit = {},
    content: @Composable (BoxScope.(AsyncImagePainter.State) -> Unit)? = null,
) {
    var state by remember(key) {
        mutableStateOf<AsyncImagePainter.State>(
            AsyncImagePainter.State.Empty
        )
    }
    SubcomposeAsyncImage(
        modifier = modifier.yifyShimmer(enableShimmer and state.isLoading),
        model = ImageRequest.Builder(LocalPlatformContext.current).apply {
//            dispatcher(Dispatchers.IO)
            builder.invoke(this)
            crossfade(true)
        }.build(),
        contentDescription = contentDescription,
        contentScale = contentScale,
        colorFilter = colorFilter,
        loading = {
            Box(
                modifier = Modifier.fillMaxSize(),
            ) {
                content?.invoke(this, it)
            }
        },
        success = {
            Box(
                modifier = Modifier.fillMaxSize(),
            ) {
                Image(
                    modifier = Modifier.fillMaxSize(),
                    painter = it.painter,
                    contentDescription = contentDescription,
                    contentScale = contentScale,
                    colorFilter = colorFilter,
                )
                content?.invoke(this, it)
            }
        },
        error = {
            Box(
                modifier = Modifier.fillMaxSize(),
            ) {
                content?.invoke(this, it)
            }
        },
        onLoading = {
            state = it
            onState.invoke(it)
        },
        onSuccess = {
            state = it
            onState.invoke(it)
        },
        onError = {
            state = it
            onState.invoke(it)
        }
    )
}