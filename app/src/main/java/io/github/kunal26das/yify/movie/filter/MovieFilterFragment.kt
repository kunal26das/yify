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
import androidx.essentials.view.ComposeBottomSheetDialogFragment
import androidx.fragment.app.viewModels
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.model.*
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.movie.Composables

@AndroidEntryPoint
class MovieFilterFragment : ComposeBottomSheetDialogFragment(), Composables {

    private var onChangeListener: OnChangeListener<*>? = null
    private val viewModel by viewModels<MovieFilterViewModel>()

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
        val queryTerm by viewModel.queryTerm.observeAsState()
        TextField(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            value = queryTerm ?: "",
            placeholder = { Text(text = getString(R.string.query_term)) },
            onValueChange = {
                viewModel.queryTerm.value = it
                onChangeListener?.invoke(null)
            }
        )
    }

    @Composable
    private fun Quality() {
        val quality by viewModel.quality.observeAsState()
        FlowChips(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            chips = Quality,
            selected = quality,
        ) {
            viewModel.quality.value = it
            onChangeListener?.invoke(null)
        }
    }

    @Composable
    private fun MinimumRating() {
        val minimumRating by viewModel.minimumRating.observeAsState()
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
                viewModel.minimumRating.value = it.toInt()
            },
        )
    }

    @Composable
    private fun Genre() {
        val genre by viewModel.genre.observeAsState()
        FlowChips(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            chips = Genre,
            selected = genre,
        ) {
            viewModel.genre.value = it
            onChangeListener?.invoke(null)
        }
    }

    @Composable
    private fun SortBy() {
        val sortBy by viewModel.sortBy.observeAsState()
        FlowChips(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            chips = SortBy.values().map { it.name },
            selected = sortBy,
        ) {
            viewModel.sortBy.value = it
            onChangeListener?.invoke(null)
        }
    }

    @Composable
    private fun OrderBy() {
        val orderBy by viewModel.orderBy.observeAsState()
        FlowChips(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            chips = OrderBy.values().map { it.name },
            selected = orderBy,
        ) {
            viewModel.orderBy.value = it
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