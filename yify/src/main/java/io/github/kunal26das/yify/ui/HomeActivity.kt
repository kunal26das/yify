package io.github.kunal26das.yify.ui

import androidx.activity.viewModels
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material3.DismissibleNavigationDrawer
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ElevatedButton
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.compose.Dropdown
import io.github.kunal26das.common.core.Activity
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.compose.Movies
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.SortBy
import io.github.kunal26das.yify.model.MoviePreference

@AndroidEntryPoint
class HomeActivity : Activity() {

    private val viewModel by viewModels<HomeViewModel>()

    @Composable
    override fun Content() {
        val drawerState = rememberDrawerState(DrawerValue.Closed)
        DismissibleNavigationDrawer(
            modifier = Modifier,
            drawerState = drawerState,
            drawerContent = {
                DrawerContent(
                    modifier = Modifier
                        .width(360.dp),
                )
            },
        ) {
            Movies(
                modifier = Modifier.fillMaxSize(),
                moviesFlow = viewModel.movies,
            )
        }
    }

    @Composable
    private fun DrawerContent(
        modifier: Modifier = Modifier,
    ) {
        val moviePreference by viewModel.moviePreference.collectAsState()
        LazyColumn(
            modifier = modifier,
            contentPadding = PaddingValues(
                start = 16.dp,
                top = 10.dp,
                end = 0.dp,
                bottom = 10.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            item {
                SearchTextField(
                    modifier = Modifier.fillMaxWidth(),
                    moviePreference = moviePreference,
                )
            }
            item {
                GenreDropdown(
                    modifier = Modifier.fillMaxWidth(),
                    moviePreference = moviePreference,
                )
            }
            item {
                QualityDropdown(
                    modifier = Modifier.fillMaxWidth(),
                    moviePreference = moviePreference,
                )
            }
            item {
                SortOrderDropdown(
                    modifier = Modifier.fillMaxWidth(),
                    moviePreference = moviePreference,
                )
            }
            item {
                MinimumRatingDropdown(
                    modifier = Modifier.fillMaxWidth(),
                    moviePreference = moviePreference,
                )
            }
            item {
                ClearButton(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                )
            }
        }
    }

    @Composable
    private fun SearchTextField(
        modifier: Modifier = Modifier,
        moviePreference: MoviePreference,
    ) {
        val focusManager = LocalFocusManager.current
        val searchQuery by viewModel.searchQuery.collectAsState()
        OutlinedTextField(
            modifier = modifier,
            readOnly = true,
            label = { Text(stringResource(R.string.search)) },
            trailingIcon = {
                Icon(
                    modifier = Modifier.clickable {
                        viewModel.search(null)
                        focusManager.clearFocus()
                    },
                    imageVector = Icons.Filled.Clear,
                    contentDescription = null,
                )
            },
            value = searchQuery,
            onValueChange = {
                viewModel.search(it)
            },
        )
    }

    @Composable
    private fun GenreDropdown(
        modifier: Modifier = Modifier,
        moviePreference: MoviePreference,
    ) {
        Dropdown(
            modifier2 = modifier,
            label = stringResource(R.string.genre),
            items = Genre.values().filter {
                it != Genre.Unknown
            },
            name = { it.name },
            selection = moviePreference.genre
        ) {
            viewModel.setGenre(it)
        }
    }

    @Composable
    private fun QualityDropdown(
        modifier: Modifier = Modifier,
        moviePreference: MoviePreference,
    ) {
        Dropdown(
            modifier2 = modifier,
            label = stringResource(R.string.quality),
            items = Quality.values().filter {
                it != Quality.Unknown
            },
            name = {
                when (it) {
                    Quality.Low -> getString(R.string.low)
                    Quality.Medium -> getString(R.string.medium)
                    Quality.High -> getString(R.string.high)
                    else -> ""
                }
            },
            selection = moviePreference.quality
        ) {
            viewModel.setQuality(it)
        }
    }

    @Composable
    private fun SortOrderDropdown(
        modifier: Modifier = Modifier,
        moviePreference: MoviePreference,
    ) {
        Row(
            modifier = modifier,
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Dropdown(
                modifier = Modifier.weight(1f),
                modifier2 = Modifier.fillMaxWidth(),
                label = stringResource(R.string.sort_by),
                items = SortBy.values().toList(),
                name = {
                    when (it) {
                        SortBy.DateAdded -> getString(R.string.date_added)
                        SortBy.DownloadCount -> getString(R.string.downloads)
                        SortBy.LikeCount -> getString(R.string.likes)
                        SortBy.Peers -> getString(R.string.peers)
                        SortBy.Rating -> getString(R.string.rating)
                        SortBy.Seeds -> getString(R.string.seeds)
                        SortBy.Title -> getString(R.string.title)
                        SortBy.Year -> getString(R.string.year)
                    }
                },
                selection = moviePreference.sortBy
            ) {
                viewModel.setSortBy(it)
            }
            AnimatedVisibility(
                modifier = Modifier.weight(1f),
                visible = true // moviePreference.sortBy != null
            ) {
                Dropdown(
                    label = stringResource(R.string.order_by),
                    items = OrderBy.values().toList(),
                    name = {
                        when (it) {
                            OrderBy.Ascending -> getString(R.string.ascending)
                            OrderBy.Descending -> getString(R.string.descending)
                        }
                    },
                    selection = moviePreference.orderBy
                ) {
                    viewModel.setOrderBy(it)
                }
            }
        }
    }

    @Composable
    private fun MinimumRatingDropdown(
        modifier: Modifier = Modifier,
        moviePreference: MoviePreference,
    ) {
        Dropdown(
            modifier2 = modifier,
            label = stringResource(R.string.minimum_rating),
            items = 0..9,
            name = { it.toString() },
            selection = moviePreference.minimumRating
        ) {
            viewModel.setMinimumRating(it)
        }
    }

    @Composable
    private fun ClearButton(
        modifier: Modifier = Modifier,
    ) {
        ElevatedButton(
            modifier = modifier,
            onClick = { viewModel.clear() },
            content = { Text(text = "Clear") }
        )
    }
}
