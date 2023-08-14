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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.common.ComposeBottomSheetDialogFragment
import io.github.kunal26das.yify.compose.FlowChips
import io.github.kunal26das.yify.model.Genre
import io.github.kunal26das.yify.model.OnChangeListener
import io.github.kunal26das.yify.model.OrderBy
import io.github.kunal26das.yify.model.Quality
import io.github.kunal26das.yify.model.SortBy
import io.github.kunal26das.yify.preference.MutableMoviePreferences
import io.github.kunal26das.yify.preference.ObservableMoviePreferences
import javax.inject.Inject

@AndroidEntryPoint
class MovieFilterFragment : ComposeBottomSheetDialogFragment() {

    @Inject
    lateinit var observableMoviePreferences: ObservableMoviePreferences

    @Inject
    lateinit var mutableMoviePreferences: MutableMoviePreferences

    private var onChangeListener: OnChangeListener<*>? = null

    @Preview
    @Composable
    override fun Content() {
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
        val queryTerm by observableMoviePreferences.getQueryTermLiveData().observeAsState()
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
        val quality by observableMoviePreferences.getQualityLiveData().observeAsState()
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
        val minimumRating by observableMoviePreferences.getMinimumRatingLiveData().observeAsState()
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
        val genre by observableMoviePreferences.getGenreLiveData().observeAsState()
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
        val sortBy by observableMoviePreferences.getSortByLiveData().observeAsState()
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
        val orderBy by observableMoviePreferences.getOrderByLiveData().observeAsState()
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