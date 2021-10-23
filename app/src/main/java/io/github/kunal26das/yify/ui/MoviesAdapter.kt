package io.github.kunal26das.yify.ui

import android.view.ViewGroup
import androidx.paging.PagingDataAdapter
import io.github.kunal26das.yify.models.Movie

class MoviesAdapter : PagingDataAdapter<Movie, MovieViewHolder>(Movie) {
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MovieViewHolder {
        return MovieViewHolder(parent)
    }

    override fun onBindViewHolder(holder: MovieViewHolder, position: Int) {
        holder.bind(getItem(position))
    }
}