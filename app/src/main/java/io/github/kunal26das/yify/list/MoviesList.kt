package io.github.kunal26das.yify.list

import android.content.Context
import android.util.AttributeSet
import android.view.ViewGroup
import androidx.essentials.list.PagedList
import androidx.essentials.list.view.ListItemView
import io.github.kunal26das.yify.databinding.ItemMovieBinding
import io.github.kunal26das.yify.source.models.Movie
import io.github.kunal26das.yify.view.MovieView

class MoviesList @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : PagedList<Movie, ItemMovieBinding>(context, attrs) {

    private var onMovieClickListener: OnMovieClickListener? = null
    override fun areContentsTheSame(oldItem: Movie, newItem: Movie) = oldItem == newItem
    override fun areItemsTheSame(oldItem: Movie, newItem: Movie) = oldItem.id == newItem.id

    override fun onCreateViewHolder(parent: ViewGroup) =
        MovieView(
            attachToRoot = false,
            context = parent.context,
            listOrientation = orientation
        ).viewHolder

    override fun onBindViewHolder(holder: ListItemView.ViewHolder<Movie, ItemMovieBinding>) {
        holder.listItemView.binding.root.setOnClickListener {
            holder.listItemView.item?.apply {
                onMovieClickListener?.onClick(this)
            }
        }
    }

    fun setOnMovieClickListener(action: (Movie) -> Unit) {
        onMovieClickListener = object : OnMovieClickListener {
            override fun onClick(movie: Movie) {
                action(movie)
            }
        }
    }

    interface OnMovieClickListener {
        fun onClick(movie: Movie)
    }
}
