package io.github.kunal26das.yify.ui

import android.graphics.drawable.Drawable
import android.view.ViewGroup
import androidx.paging.PagingDataAdapter
import io.github.kunal26das.yify.models.Movie

class MoviesAdapter : PagingDataAdapter<Movie, MovieViewHolder>(Movie) {

    private val images = mutableMapOf<Int, Drawable>()

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MovieViewHolder {
        return MovieViewHolder(parent)
    }

    override fun onBindViewHolder(holder: MovieViewHolder, position: Int) {
        val movie = getItem(position)
        if (movie != null) {
            holder.bind(movie, images[movie.id]) {
                images[movie.id] = it
            }
        }
    }
}