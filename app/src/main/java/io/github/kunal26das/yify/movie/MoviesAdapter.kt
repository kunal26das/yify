package io.github.kunal26das.yify.movie

import android.view.ViewGroup
import androidx.recyclerview.widget.ListAdapter
import io.github.kunal26das.yify.models.Movie
import io.github.kunal26das.yify.models.OnClickListener

class MoviesAdapter : ListAdapter<Movie, MovieViewHolder>(Movie) {

    private var onClickListener: OnClickListener<Movie>? = null

    override fun onCreateViewHolder(
        parent: ViewGroup, viewType: Int
    ) = MovieViewHolder(parent)

    override fun onBindViewHolder(holder: MovieViewHolder, position: Int) {
        val movie = getItem(position)
        holder.bind(movie)?.root?.setOnClickListener {
            onClickListener?.onClick(movie)
        }
    }

    fun setOnClickListener(onClickListener: OnClickListener<Movie>) {
        this.onClickListener = onClickListener
    }

}