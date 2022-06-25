package io.github.kunal26das.yify.movie

import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import io.github.kunal26das.model.Movie
import io.github.kunal26das.model.OnClickListener

class MoviesAdapter : ListAdapter<Movie, MovieViewHolder>(MoviesAdapter) {

    private var onClickListener: OnClickListener<Movie>? = null

    override fun onCreateViewHolder(
        parent: ViewGroup, viewType: Int
    ) = MovieViewHolder(parent)

    override fun onBindViewHolder(holder: MovieViewHolder, position: Int) {
        val movie = getItem(position)
        holder.bind(movie)
        holder.binding?.root?.setOnClickListener {
            onClickListener?.invoke(movie)
        }
    }

    fun setOnClickListener(onClickListener: OnClickListener<Movie>) {
        this.onClickListener = onClickListener
    }

    companion object : DiffUtil.ItemCallback<Movie>() {
        override fun areItemsTheSame(oldItem: Movie, newItem: Movie): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Movie, newItem: Movie): Boolean {
            return oldItem == newItem
        }
    }

}