package io.github.kunal26das.yify.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.cachedIn
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.Rating
import io.github.kunal26das.yify.domain.model.SortBy
import io.github.kunal26das.yify.model.MoviePreference
import io.github.kunal26das.yify.source.factory.MoviesSourceFactory
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flatMapLatest
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val moviesSourceFactory: MoviesSourceFactory,
) : ViewModel() {

    private val _moviePreference = MutableStateFlow(MoviePreference())
    val moviePreference = _moviePreference.asStateFlow()

    @OptIn(FlowPreview::class, ExperimentalCoroutinesApi::class)
    val movies = moviePreference
        .debounce(750L)
        .flatMapLatest {
            Pager(
                config = PagingConfig(
                    pageSize = LOAD_SIZE,
                    initialLoadSize = LOAD_SIZE,
                ),
                pagingSourceFactory = {
                    moviesSourceFactory.get(it)
                },
            ).flow
        }.cachedIn(viewModelScope)

    fun search(queryTerm: String?) {
        moviePreference.value.let {
            _moviePreference.value = it.copy(queryTerm = queryTerm)
        }
    }

    fun setGenre(genre: Genre?) {
        moviePreference.value.let {
            _moviePreference.value = it.copy(genre = genre)
        }
    }

    fun setQuality(quality: Quality?) {
        moviePreference.value.let {
            _moviePreference.value = it.copy(quality = quality)
        }
    }

    fun setSortBy(sortBy: SortBy?) {
        moviePreference.value.let {
            _moviePreference.value = it.copy(sortBy = sortBy)
        }
    }

    fun setOrderBy(orderBy: OrderBy?) {
        moviePreference.value.let {
            _moviePreference.value = it.copy(orderBy = orderBy)
        }
    }

    fun setMinimumRating(rating: Rating?) {
        moviePreference.value.let {
            _moviePreference.value = it.copy(minimumRating = rating)
        }
    }

    fun clear() {
        moviePreference.value.let {
            _moviePreference.value = MoviePreference()
        }
    }

    companion object {
        private const val LOAD_SIZE = 10
    }
}