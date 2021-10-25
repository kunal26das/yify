package io.github.kunal26das.yify.ui

import android.graphics.drawable.Drawable
import android.view.ViewGroup
import coil.load
import coil.request.Disposable
import coil.request.ImageRequest
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ItemMovieBinding
import io.github.kunal26das.yify.models.Movie

class MovieViewHolder(
    parent: ViewGroup,
) : ViewHolder<Movie, ItemMovieBinding>(parent, R.layout.item_movie) {

    private var disposable: Disposable? = null

    fun bind(
        item: Movie?,
        image: Drawable? = null,
        drawable: ((Drawable) -> Unit)? = null,
    ): ItemMovieBinding? {
        binding.movie = item
        disposable?.dispose()
        binding.executePendingBindings()
        val lambda: ImageRequest.Builder.() -> Unit = {
            if (drawable != null) target({}, {}, {
                binding.image.setImageDrawable(it)
                drawable.invoke(it)
            })
//            placeholderMemoryCacheKey(binding.image.metadata?.memoryCacheKey)
        }
        disposable = when (image) {
            null -> binding.image.load(item?.largeCoverImage, imageLoader, lambda)
            else -> binding.image.load(image, imageLoader, lambda)
        }
        return super.bind(item)
    }

}