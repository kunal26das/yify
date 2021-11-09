package io.github.kunal26das.yify.ui

import android.graphics.drawable.Drawable
import android.view.ViewGroup
import androidx.paging.PagingDataAdapter
import coil.load
import io.github.kunal26das.yify.models.Movie

class MoviesAdapter : PagingDataAdapter<Movie, MovieViewHolder>(Movie) {

    private val images = mutableMapOf<Int, Drawable>()

    override fun onCreateViewHolder(
        parent: ViewGroup, viewType: Int
    ) = MovieViewHolder(parent)

    override fun onBindViewHolder(holder: MovieViewHolder, position: Int) {
        val movie = getItem(position)
        val binding = holder.bind(movie)
        if (movie != null && binding != null) {
            when (val image = images[movie.id]) {
                null -> holder.disposable = binding.image.load(movie.largeCoverImage) {
                    target {
                        binding.image.setImageDrawable(it)
                        images[movie.id] = it
                    }
                }
                else -> binding.image.setImageDrawable(image)
            }
        }
    }

}