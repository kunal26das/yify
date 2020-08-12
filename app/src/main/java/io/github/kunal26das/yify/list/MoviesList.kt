package io.github.kunal26das.yify.list

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import androidx.core.graphics.drawable.toBitmap
import androidx.essentials.extensions.Coroutines.default
import androidx.essentials.list.PagedList
import androidx.palette.graphics.Palette
import coil.api.load
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ItemMovieBinding
import io.github.kunal26das.yify.source.models.Movie

class MoviesList @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : PagedList<Movie, ItemMovieBinding>(context, attrs) {

    override val emptyMessage = "No movies found"
    override val itemLayout = R.layout.item_movie
    override val mLayoutManager = linearLayoutManager
    override fun areContentsTheSame(oldItem: Movie, newItem: Movie) = oldItem == newItem
    override fun areItemsTheSame(oldItem: Movie, newItem: Movie) = oldItem.id == newItem.id

    override fun onBindViewHolder(itemView: ItemMovieBinding, item: Movie) {
        itemView.apply {
            movie = item
            executePendingBindings()
            moviePosterImageView.load(movie?.largeCoverImage) {
                buildMovieCard(itemView, item)
            }
        }
    }

    private fun buildMovieCard(itemView: ItemMovieBinding, item: Movie?) {
        itemView.default {
            Palette.Builder(moviePosterImageView.drawable.toBitmap()).generate().apply {
                getDominantColor(0).apply {
                    movieCardView.setCardBackgroundColor(this)
                    val colors = intArrayOf(this, Color.parseColor("#00000000"))
                    moviePosterImageView.foreground = GradientDrawable(
                        GradientDrawable.Orientation.LEFT_RIGHT,
                        colors
                    )
                    (-16777215 - this).apply {
                        movieTitleTextView.setTextColor(this)
                        movieGenresTextView.setTextColor(this)
                        var genres = ""
                        item?.genres?.forEachIndexed { index, genre ->
                            genres += when (index) {
                                0 -> ""
                                else -> "\n"
                            } + genre
                        }
                        movieGenresTextView.text = genres
                    }
                }
            }
        }
    }

}