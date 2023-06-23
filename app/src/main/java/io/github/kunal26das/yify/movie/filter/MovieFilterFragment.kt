package io.github.kunal26das.yify.movie.filter

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.model.Genre
import io.github.kunal26das.model.OnChangeListener
import io.github.kunal26das.model.OrderBy
import io.github.kunal26das.model.Quality
import io.github.kunal26das.model.SortBy
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.core.ComposeBottomSheetDialogFragment
import io.github.kunal26das.yify.movie.Composables
import io.github.kunal26das.yify.preference.MoviePreferences
import io.github.kunal26das.yify.preference.MutableMoviePreferences
import io.github.kunal26das.yify.preference.ObservableMoviePreferences
import javax.inject.Inject

@AndroidEntryPoint
class MovieFilterFragment : ComposeBottomSheetDialogFragment(), Composables {

//    @Inject
//    lateinit var observableMoviePreferences: ObservableMoviePreferences

    @Inject
    lateinit var mutableMoviePreferences: MutableMoviePreferences

    @Inject
    lateinit var moviePreferences: MoviePreferences

    private var onChangeListener: OnChangeListener<*>? = null

    @Preview
    @Composable
    override fun setContent() {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp)
                .verticalScroll(ScrollState(0))
        ) {
            QueryTerm()
            Quality()
            MinimumRating()
            Genre()
            SortBy()
            OrderBy()
        }
    }

    @Composable
    private fun QueryTerm() {
        val queryTerm = moviePreferences.getQueryTerm()
        TextField(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            value = queryTerm ?: "",
            placeholder = { Text(text = getString(R.string.query_term)) },
            onValueChange = {
                mutableMoviePreferences.setQueryTerm(it)
                onChangeListener?.invoke(null)
            }
        )
    }

    @Composable
    private fun Quality() {
        val quality = moviePreferences.getQuality()
        FlowChips(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            chips = Quality,
            selected = quality,
        ) {
            mutableMoviePreferences.setQuality(it)
            onChangeListener?.invoke(null)
        }
    }

    @Composable
    private fun MinimumRating() {
        val minimumRating = moviePreferences.getMinimumRating()
        Slider(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            value = minimumRating?.toFloat() ?: 0f,
            valueRange = 0f..9f,
            steps = 8,
            onValueChangeFinished = {
                onChangeListener?.invoke(null)
            },
            onValueChange = {
                mutableMoviePreferences.setMinimumRating(it.toInt())
            },
        )
    }

    @Composable
    private fun Genre() {
        val genre = moviePreferences.getGenre()
        FlowChips(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            chips = Genre,
            selected = genre,
        ) {
            mutableMoviePreferences.setGenre(it)
            onChangeListener?.invoke(null)
        }
    }

    @Composable
    private fun SortBy() {
        val sortBy = moviePreferences.getSortBy()
        FlowChips(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            chips = SortBy.values().map { it.name },
            selected = sortBy,
        ) {
            mutableMoviePreferences.setSortBy(it)
            onChangeListener?.invoke(null)
        }
    }

    @Composable
    private fun OrderBy() {
        val orderBy = moviePreferences.getOrderBy()
        FlowChips(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            chips = OrderBy.values().map { it.name },
            selected = orderBy,
        ) {
            mutableMoviePreferences.setOrderBy(it)
            onChangeListener?.invoke(null)
        }
    }

    fun setOnFiltersChangeListener(
        onChangeListener: OnChangeListener<*>
    ): MovieFilterFragment {
        this.onChangeListener = onChangeListener
        return this
    }

}