package io.github.kunal26das.yify.list

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import androidx.core.graphics.drawable.toBitmap
import androidx.essentials.list.PagedList
import androidx.palette.graphics.Palette
import com.squareup.picasso.Callback
import com.squareup.picasso.Picasso
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
    private val transparentColor = Color.parseColor("#00000000")
    override fun areContentsTheSame(oldItem: Movie, newItem: Movie) = oldItem == newItem
    override fun areItemsTheSame(oldItem: Movie, newItem: Movie) = oldItem.id == newItem.id

    override fun onBindViewHolder(itemView: ItemMovieBinding, item: Movie) {
        itemView.apply {
            movie = item
            var genres = ""
            item.genres.forEachIndexed { index, genre ->
                genres += when (index) {
                    0 -> ""
                    else -> "\n"
                } + genre
            }
            executePendingBindings()
            movieGenresTextView.text = genres
            Picasso.get().load(movie?.largeCoverImage)
                .into(moviePosterImageView, object : Callback {
                    override fun onSuccess() {
                        val dominantColor =
                            Palette.Builder(moviePosterImageView.drawable.toBitmap())
                                .generate()
                                .getDominantColor(transparentColor)
                        val antiDominantColor = -16777215 - dominantColor
                        movieCardView.setCardBackgroundColor(dominantColor)
                        moviePosterImageView.foreground = GradientDrawable(
                            GradientDrawable.Orientation.LEFT_RIGHT,
                            intArrayOf(dominantColor, transparentColor)
                        )
                        movieTitleTextView.setTextColor(antiDominantColor)
                        movieGenresTextView.setTextColor(antiDominantColor)
                    }

                    override fun onError(e: Exception?) {}
                })
        }
    }
}
