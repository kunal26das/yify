package io.github.kunal26das.yify.ui

import android.content.Context
import android.content.Intent
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.viewModels
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material3.DismissibleNavigationDrawer
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.common.compose.Dropdown
import io.github.kunal26das.common.compose.statusBarHeight
import io.github.kunal26das.common.core.Activity
import io.github.kunal26das.yify.R
import io.github.kunal26das.yify.compose.SystemBarGradient
import io.github.kunal26das.yify.compose.VerticalGridMovies
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.SortBy

@AndroidEntryPoint
class MoviesActivity : Activity() {

    private val viewModel by viewModels<MoviesViewModel>()
    private val movieActivity = registerForActivityResult(MovieActivity.Contract())

    private lateinit var onBackPressedCallback: OnBackPressedCallback

    @Composable
    override fun Content() {
        val drawerState = rememberDrawerState(DrawerValue.Closed)
        onBackPressedCallback = addOnBackPressedDispatcherCallback(rememberCoroutineScope()) {
            if (drawerState.isOpen) {
                drawerState.close()
            } else finish()
        }
        BackHandler(true) {
            onBackPressedCallback.handleOnBackPressed()
        }
        DismissibleNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ElevatedCard(
                    modifier = Modifier
                        .width(360.dp)
                        .fillMaxHeight(),
                    shape = RoundedCornerShape(
                        bottomEnd = 16.dp,
                        topEnd = 16.dp,
                    )
                ) {
                    DrawerContent()
                }
            },
        ) {
            Box {
                VerticalGridMovies(
                    modifier = Modifier.fillMaxSize(),
                    moviesFlow = viewModel.movies,
                ) {
                    movieActivity.launch(it?.id)
                }
                SystemBarGradient(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.TopCenter),
                    reverse = false,
                )
                SystemBarGradient(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter),
                    reverse = true,
                )
            }
        }
    }

    @Composable
    private fun DrawerContent(
        modifier: Modifier = Modifier,
    ) {
        LazyColumn(
            modifier = modifier,
            contentPadding = PaddingValues(
                start = 16.dp,
                top = statusBarHeight,
                end = 16.dp,
                bottom = statusBarHeight,
            ),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            item {
                SearchTextField(
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                GenreDropdown(
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                QualityDropdown(
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                MinimumRatingDropdown(
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                SortByDropdown(
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            item {
                OrderByDropdown(
                    modifier = Modifier.fillMaxWidth(),
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
    ) {
        val focusManager = LocalFocusManager.current
        val searchQuery by viewModel.searchQuery.collectAsState()
        OutlinedTextField(
            modifier = modifier,
            readOnly = false,
            label = { Text(stringResource(R.string.search)) },
            trailingIcon = {
                IconButton(
                    onClick = {
                        viewModel.search(null)
                        focusManager.clearFocus()
                    }
                ) {
                    Icon(
                        imageVector = Icons.Filled.Clear,
                        contentDescription = null,
                    )
                }
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
    ) {
        val moviePreference by viewModel.moviePreference.collectAsState()
        Dropdown(
            modifier2 = modifier,
            label = stringResource(R.string.genre),
            selection = moviePreference?.genre,
            items = Genre.values().filter {
                it != Genre.Unknown
            },
            name = { it.name },
            onSelect = {
                viewModel.setGenre(it)
            }
        )
    }

    @Composable
    private fun QualityDropdown(
        modifier: Modifier = Modifier,
    ) {
        val moviePreference by viewModel.moviePreference.collectAsState()
        Dropdown(
            modifier2 = modifier,
            label = stringResource(R.string.quality),
            selection = moviePreference?.quality,
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
            onSelect = {
                viewModel.setQuality(it)
            }
        )
    }

    @Composable
    private fun MinimumRatingDropdown(
        modifier: Modifier = Modifier,
    ) {
        val moviePreference by viewModel.moviePreference.collectAsState()
        Dropdown(
            modifier2 = modifier,
            label = stringResource(R.string.minimum_rating),
            selection = moviePreference?.minimumRating,
            items = 0..9,
            name = { it.toString() },
            onSelect = {
                viewModel.setMinimumRating(it)
            }
        )
    }

    @Composable
    private fun SortByDropdown(
        modifier: Modifier = Modifier,
    ) {
        val moviePreference by viewModel.moviePreference.collectAsState()
        Dropdown(
            modifier = modifier,
            modifier2 = Modifier.fillMaxWidth(),
            label = stringResource(R.string.sort_by),
            selection = moviePreference?.sortBy,
            items = SortBy.values().toList(),
            name = {
                when (it) {
                    SortBy.DateAdded -> getString(R.string.date_added)
                    SortBy.Peers -> getString(R.string.peers)
                    SortBy.Rating -> getString(R.string.rating)
                    SortBy.Seeds -> getString(R.string.seeds)
                    SortBy.Title -> getString(R.string.title)
                    SortBy.Year -> getString(R.string.year)
                }
            },
            onSelect = {
                viewModel.setSortBy(it)
            },
        )
    }

    @Composable
    private fun OrderByDropdown(
        modifier: Modifier = Modifier,
    ) {
        val moviePreference by viewModel.moviePreference.collectAsState()
        AnimatedVisibility(
            modifier = modifier,
            visible = moviePreference?.sortBy != null
        ) {
            Dropdown(
                modifier2 = Modifier.fillMaxWidth(),
                label = stringResource(R.string.order_by),
                selection = moviePreference?.orderBy,
                items = OrderBy.values().toList(),
                name = {
                    when (it) {
                        OrderBy.Ascending -> getString(R.string.ascending)
                        OrderBy.Descending -> getString(R.string.descending)
                    }
                },
                onSelect = {
                    viewModel.setOrderBy(it)
                },
            )
        }
    }

    @Composable
    private fun MovieCountText(
        modifier: Modifier = Modifier,
    ) {
        val maxMovieCount by viewModel.maxMovieCount.collectAsState()
        val currentMovieCount by viewModel.currentMovieCount.collectAsState()
        Surface(modifier = modifier) {
            Text(text = "Showing $currentMovieCount out of $maxMovieCount movies.")
        }
    }

    @Composable
    private fun ClearButton(
        modifier: Modifier = Modifier,
    ) {
        OutlinedButton(
            modifier = modifier,
            onClick = { viewModel.clear() },
            content = { Text(text = stringResource(R.string.clear)) }
        )
    }

    class Contract : ActivityResultContract<Any?, Boolean>() {
        override fun createIntent(context: Context, input: Any?): Intent {
            return Intent(context, MoviesActivity::class.java)
        }

        override fun parseResult(resultCode: Int, intent: Intent?): Boolean {
            return resultCode == RESULT_OK
        }
    }
}
