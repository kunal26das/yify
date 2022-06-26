package io.github.kunal26das.yify.movie.filter

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.livedata.observeAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.essentials.view.ComposeBottomSheetDialogFragment
import androidx.fragment.app.viewModels
import com.google.accompanist.flowlayout.FlowRow
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.model.*
import io.github.kunal26das.yify.R

@AndroidEntryPoint
@OptIn(ExperimentalMaterial3Api::class)
class MovieFilterFragment : ComposeBottomSheetDialogFragment() {

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
            MovieQueryTerm()
            MovieQuality()
            MovieMinimumRating()
            MovieGenre()
            MovieSortBy()
            MovieOrderBy()
        }
    }

    @Composable
    private fun MovieQueryTerm() {
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
    private fun MovieQuality() {
        val quality by viewModel.quality.observeAsState()
        FlowRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp)
        ) {
            Quality.forEach {
                FilterChip(
                    modifier = Modifier.padding(4.dp),
                    label = { Text(text = it) },
                    selected = it == quality,
                    onClick = {
                        viewModel.quality.value = it
                        onChangeListener?.invoke(null)
                    }
                )
            }
        }
    }

    @Composable
    private fun MovieMinimumRating() {
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
    private fun MovieGenre() {
        val genre by viewModel.genre.observeAsState()
        FlowRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp)
        ) {
            Genre.forEach {
                FilterChip(
                    modifier = Modifier.padding(4.dp),
                    label = { Text(text = it) },
                    selected = it == genre,
                    onClick = {
                        viewModel.genre.value = it
                        onChangeListener?.invoke(null)
                    }
                )
            }
        }
    }

    @Composable
    private fun MovieSortBy() {
        val sortBy by viewModel.sortBy.observeAsState()
        FlowRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp)
        ) {
            SortBy.values().forEach {
                FilterChip(
                    modifier = Modifier.padding(4.dp),
                    label = { Text(text = it.name) },
                    selected = it.name == sortBy,
                    onClick = {
                        viewModel.sortBy.value = it.name
                        onChangeListener?.invoke(null)
                    }
                )
            }
        }
    }

    @Composable
    private fun MovieOrderBy() {
        val orderBy by viewModel.orderBy.observeAsState()
        FlowRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp)
        ) {
            OrderBy.values().forEach {
                FilterChip(
                    modifier = Modifier.padding(4.dp),
                    label = { Text(text = it.name) },
                    selected = it.name == orderBy,
                    onClick = {
                        viewModel.orderBy.value = it.name
                        onChangeListener?.invoke(null)
                    }
                )
            }
        }
    }

    fun setOnFiltersChangeListener(
        onChangeListener: OnChangeListener<*>
    ): MovieFilterFragment {
        this.onChangeListener = onChangeListener
        return this
    }

}