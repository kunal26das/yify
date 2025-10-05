package io.github.kunal26das.yify.movies.compose

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.kunal26das.yify.movies.domain.model.Genre
import io.github.kunal26das.yify.movies.domain.model.OrderBy
import io.github.kunal26das.yify.movies.domain.model.Quality
import io.github.kunal26das.yify.movies.domain.model.SortBy
import io.github.kunal26das.yify.movies.presentation.MoviesViewModel
import org.koin.compose.viewmodel.koinViewModel

@Composable
fun DrawerContent(
    modifier: Modifier = Modifier,
) {
    val contentModifier = Modifier.fillMaxWidth()
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        GenreDropdown(modifier = contentModifier)
        QualityDropdown(modifier = contentModifier)
        SortByDropdown(modifier = contentModifier)
        MinimumRating(modifier = contentModifier.padding(horizontal = 8.dp))
        ClearButton(modifier = contentModifier)
    }
}

@Composable
private fun GenreDropdown(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel()
) {
    val cornerRadius = LocalCornerRadius.current
    val moviePreference by viewModel.moviePreference.collectAsState()
    Dropdown(
        modifier2 = modifier,
        label = "Genre",
        shape = RoundedCornerShape(cornerRadius / 1.5f),
        selection = moviePreference.genre,
        items = Genre.entries,
        name = { it.name },
        onSelect = {
            viewModel.setGenre(it)
        }
    )
}

@Composable
private fun QualityDropdown(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel(),
) {
    val cornerRadius = LocalCornerRadius.current
    val moviePreference by viewModel.moviePreference.collectAsState()
    Dropdown(
        modifier2 = modifier,
        label = "Quality",
        shape = RoundedCornerShape(cornerRadius / 1.5f),
        selection = moviePreference.quality,
        items = Quality.entries.reversed(),
        showTrailingIcon = false,
        name = {
            it.name
        },
        onSelect = {
            viewModel.setQuality(it)
        }
    )
}

@Composable
private fun SortByDropdown(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel(),
) {
    val cornerRadius = LocalCornerRadius.current
    val moviePreference by viewModel.moviePreference.collectAsState()
    Dropdown(
        modifier = modifier,
        modifier2 = Modifier.fillMaxWidth(),
        label = "Sort By",
        selection = moviePreference.sortBy,
        shape = RoundedCornerShape(cornerRadius / 1.5f),
        items = listOf(SortBy.DateAdded, SortBy.Title, SortBy.Year, SortBy.Rating),
        name = {
            it.name
        },
        onSelect = {
            viewModel.setSortBy(it)
        },
        trailingIcon = {
            IconButton(
                onClick = {
                    viewModel.setOrderBy(
                        when (moviePreference.orderBy) {
                            OrderBy.Ascending -> OrderBy.Descending
                            OrderBy.Descending -> OrderBy.Ascending
                        }
                    )
                }
            ) {
                Icon(
                    imageVector = when (moviePreference.orderBy) {
                        OrderBy.Descending -> Icons.Filled.ArrowDownward
                        OrderBy.Ascending -> Icons.Filled.ArrowUpward
                    },
                    contentDescription = null,
                )
            }
        }
    )
}

@Composable
private fun MinimumRating(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel(),
) {
    val moviePreference by viewModel.moviePreference.collectAsState()
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = "Rating")
        Slider(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 12.dp),
            steps = 10,
            valueRange = 0f..9f,
            value = moviePreference.minimumRating.toFloat(),
            onValueChange = {
                viewModel.setMinimumRating(it.toInt())
            }
        )
        Text(text = moviePreference.minimumRating.toString())
    }
}

@Composable
private fun ClearButton(
    modifier: Modifier = Modifier,
    viewModel: MoviesViewModel = koinViewModel()
) {
    OutlinedButton(
        modifier = modifier,
        onClick = { viewModel.clear() },
        contentPadding = PaddingValues(12.dp),
        content = { Text("Reset") }
    )
}