package io.github.kunal26das.yify.movie.list

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.essentials.view.ComposeActivity
import androidx.paging.compose.collectAsLazyPagingItems
import coil.compose.AsyncImage
import dagger.hilt.android.AndroidEntryPoint
import io.github.kunal26das.model.Movie
import io.github.kunal26das.yify.movie.profile.MovieActivity

@AndroidEntryPoint
class MovieListActivity : ComposeActivity() {

    private val viewModel by viewModels<MovieListViewModel>()
    private val movieActivity = registerForActivityResult(MovieActivity) {}

    @Composable
    @SuppressLint("ComposableNaming")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val movies = viewModel.movies.collectAsLazyPagingItems()
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            content = {
                items(movies.itemCount) { index ->
                    Movie(movie = movies[index])
                }
            }
        )
    }

    @Composable
    @OptIn(ExperimentalMaterial3Api::class)
    private fun Movie(movie: Movie?) {
        ElevatedCard(
            modifier = Modifier.padding(8.dp),
            onClick = { movieActivity.launch(movie) }
        ) {
            AsyncImage(
                modifier = Modifier.fillMaxSize(),
                contentDescription = null,
                model = movie?.coverImage,
            )
        }
    }

}
