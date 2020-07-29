package io.github.kunal26das.yify.list

import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.graphics.drawable.toBitmap
import androidx.databinding.DataBindingUtil
import androidx.paging.PagedListAdapter
import androidx.palette.graphics.Palette
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.RecyclerView
import com.squareup.picasso.Callback
import com.squareup.picasso.Picasso
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.databinding.ItemMovieBinding
import io.github.kunal26das.yify.source.models.Movie


/**
 * Created by kunal on 22-12-2019.
 */

class MoviesAdapter : PagedListAdapter<Movie, MoviesAdapter.MovieHolder>(MovieDiffCallback) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MovieHolder {
        parent.apply {
            return MovieHolder(
                DataBindingUtil.inflate(
                    LayoutInflater.from(context),
                    R.layout.item_movie,
                    this, false
                )
            )
        }
    }

    override fun onBindViewHolder(holder: MovieHolder, position: Int) {
        holder.itemMovieBinding.apply {
            movie = getItem(position)
            executePendingBindings()
            Picasso.get().load(movie?.largeCoverImage)
                .into(moviePosterImageView, object : Callback {
                    override fun onSuccess() {
                        buildMovieCard(holder, position)
                    }

                    override fun onError(e: Exception?) {}
                })
            root.setOnClickListener {

            }
        }
    }

    private fun buildMovieCard(holder: MovieHolder, position: Int) {
        holder.itemMovieBinding.apply {
            Palette.Builder(moviePosterImageView.drawable.toBitmap()).generate().apply {
                getDominantColor(0).apply {
                    movieCardView.setCardBackgroundColor(this)
                    val colors = intArrayOf(this, Color.parseColor("#00000000"))
                    moviePosterImageView.foreground = GradientDrawable(
                        GradientDrawable.Orientation.LEFT_RIGHT,
                        colors
                    )
                    (-16777215 - this).apply {
                        getItem(position)?.torrents?.any {
                            it.quality == "720p"
                        }.let {
                            quality720pButton.visibility = when (it) {
                                true -> View.VISIBLE
                                else -> View.GONE
                            }
                            quality720pButton.setTextColor(this)
                            ColorStateList.valueOf(this).apply {
                                quality720pButton.rippleColor = this
                                quality720pButton.strokeColor = this
                            }
                        }
                        getItem(position)?.torrents?.any {
                            it.quality == "1080p"
                        }.let {
                            quality1080pButton.visibility = when (it) {
                                true -> View.VISIBLE
                                else -> View.GONE
                            }
                            quality1080pButton.setTextColor(this)
                            ColorStateList.valueOf(this).apply {
                                quality1080pButton.rippleColor = this
                                quality1080pButton.strokeColor = this
                            }
                        }
                        movieTitleTextView.setTextColor(this)
                        movieGenresTextView.setTextColor(this)
                        var genres = ""
                        getItem(position)?.genres?.forEachIndexed { index, genre ->
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

    inner class MovieHolder(val itemMovieBinding: ItemMovieBinding) :
        RecyclerView.ViewHolder(itemMovieBinding.root)

    companion object {
        val MovieDiffCallback = object : DiffUtil.ItemCallback<Movie>() {
            override fun areItemsTheSame(oldItem: Movie, newItem: Movie): Boolean {
                return oldItem.id == newItem.id
            }

            override fun areContentsTheSame(oldItem: Movie, newItem: Movie): Boolean {
                return oldItem == newItem
            }
        }
    }
}