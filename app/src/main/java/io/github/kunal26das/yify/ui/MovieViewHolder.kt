package io.github.kunal26das.yify.ui

import android.view.ViewGroup
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ItemMovieBinding
import io.github.kunal26das.yify.models.Movie

class MovieViewHolder(
    parent: ViewGroup,
) : ViewHolder<Movie, ItemMovieBinding>(parent, R.layout.item_movie) {
    override fun bind(item: Movie?): ItemMovieBinding? {
        binding?.movie = item
        binding?.executePendingBindings()
        return super.bind(item)
    }
}