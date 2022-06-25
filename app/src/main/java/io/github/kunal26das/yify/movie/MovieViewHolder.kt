package io.github.kunal26das.yify.movie

import android.graphics.drawable.Drawable
import android.view.ViewGroup
import androidx.essentials.view.ViewHolder
import coil.load
import coil.request.Disposable
import io.github.kunal26das.model.Movie
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ItemMovieBinding
import java.util.*

class MovieViewHolder(parent: ViewGroup) :
    ViewHolder<ItemMovieBinding>(parent, R.layout.item_movie) {

    private var disposable: Disposable? = null

    fun bind(item: Movie?): MovieViewHolder {
        binding?.movie = item
        disposable?.dispose()
        binding?.executePendingBindings()
        binding?.image?.setImageDrawable(null)
        if (item != null) when (val image = get(item.id)) {
            null -> disposable = binding?.image?.load(item.coverImage) {
                target {
                    binding.image.setImageDrawable(it)
                    put(item.id, it)
                }
            }
            else -> binding?.image?.setImageDrawable(image)
        }
        return this
    }

    companion object : WeakHashMap<Int, Drawable>()

}