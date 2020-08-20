package io.github.kunal26das.yify.view

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.view.LayoutInflater
import androidx.core.graphics.drawable.toBitmap
import androidx.essentials.list.AbstractList.Companion.DEFAULT_ORIENTATION
import androidx.essentials.list.view.ListItemView
import androidx.palette.graphics.Palette
import com.squareup.picasso.Callback
import com.squareup.picasso.Picasso
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ItemMovieBinding
import io.github.kunal26das.yify.source.models.Movie

class MovieView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = R.attr.materialCardViewStyle,
    attachToRoot: Boolean = DEFAULT_ATTACH_TO_ROOT,
    listOrientation: Int = DEFAULT_ORIENTATION
) : ListItemView<Movie, ItemMovieBinding>(
    context, attrs, defStyleAttr, attachToRoot, listOrientation
) {

    private val transparentColor = Color.parseColor("#00000000")
    override val binding = ItemMovieBinding.inflate(
        LayoutInflater.from(context), this, attachToRoot
    )

    init {
        radius = 16f
        cardElevation = 8f
    }

    override fun bind(item: Movie) {
        binding.apply {
            movie = item
            var genres = ""
            executePendingBindings()
            item.genres.forEachIndexed { index, genre ->
                genres += when (index) {
                    0 -> ""
                    else -> "\n"
                } + genre
            }
            movieGenresTextView.text = genres
            Picasso.get().load(item.mediumCoverImage)
                .into(moviePosterImageView, object : Callback {
                    override fun onSuccess() {
                        val dominantColor =
                            Palette.Builder(moviePosterImageView.drawable.toBitmap())
                                .generate().getDominantColor(transparentColor)
                        setCardBackgroundColor(dominantColor)
                        val antiDominantColor = -16777215 - dominantColor
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