package io.github.kunal26das.yify.movie.list

import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.yify.preference.Filters
import io.github.kunal26das.yify.repository.MovieRepository
import io.github.kunal26das.yify.source.NewMoviesSource
import java.util.Calendar
import javax.inject.Inject

@HiltViewModel
class NewMoviesViewModel @Inject constructor(
    private val movieRepository: MovieRepository,
) : MovieListViewModel() {

    private val Calendar.date: Calendar
        get() {
            this[Calendar.MILLISECOND] = 0
            this[Calendar.SECOND] = 0
            this[Calendar.MINUTE] = 0
            this[Calendar.HOUR_OF_DAY] = 0
            return this
        }

    private val yesterday
        get() = unixTime {
            date.add(Calendar.DATE, -1)
        }

    init {
        refresh()
    }

    override suspend fun refreshInternal(delayTimeMillis: Long) {
        super.refresh(delayTimeMillis) {
            NewMoviesSource(movieRepository, Filters(yesterday))
        }
    }

    private fun unixTime(
        operation: Calendar.() -> Unit
    ): Long {
        val calendar = Calendar.getInstance()
        operation.invoke(calendar)
        return calendar.timeInMillis / 1000L
    }

}