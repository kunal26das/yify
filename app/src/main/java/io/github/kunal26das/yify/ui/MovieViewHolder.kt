package io.github.kunal26das.yify.ui

import android.view.ViewGroup
import coil.request.Disposable
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ItemMovieBinding
import io.github.kunal26das.yify.models.Movie

class MovieViewHolder(
    parent: ViewGroup,
) : ViewHolder<Movie, ItemMovieBinding>(parent, R.layout.item_movie) {

    internal var disposable: Disposable? = null

    override fun bind(item: Movie?): ItemMovieBinding? {
        binding.movie = item
        disposable?.dispose()
        binding.executePendingBindings()
        binding.image.setImageDrawable(null)
        return super.bind(item)
    }

}