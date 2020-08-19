package io.github.kunal26das.yify.source

import android.util.Log
import androidx.essentials.core.KoinComponent.inject
import androidx.paging.DataSource
import androidx.paging.PageKeyedDataSource
import io.github.kunal26das.yify.source.models.Movie
import io.github.kunal26das.yify.source.repositories.MovieRepository
import io.reactivex.android.schedulers.AndroidSchedulers
import io.reactivex.disposables.CompositeDisposable
import io.reactivex.schedulers.Schedulers


/**
 * Created by kunal on 27-12-2019.
 */

class YifyDataSource : PageKeyedDataSource<Int, Movie>() {

    private val compositeDisposable = CompositeDisposable()
    private val movieRepository: MovieRepository by inject()

    val factory = object : DataSource.Factory<Int, Movie>() {
        override fun create(): DataSource<Int?, Movie> {
            return this@YifyDataSource
        }
    }

    override fun loadInitial(
        params: LoadInitialParams<Int>,
        callback: LoadInitialCallback<Int, Movie>
    ) {
        val page = 1
        compositeDisposable.add(
            movieRepository.getMovies(page)
                .subscribeOn(Schedulers.io())
                .observeOn(AndroidSchedulers.mainThread())
                .subscribe({
                    Log.d("Page ${it.data.pageNumber}", "${it.data.movies.size} Movies")
                    callback.onResult(it.data.movies, null, page)
                }, {
                    Log.e("Error", it.message!!)
                    loadInitial(params, callback)
                })
        )
    }

    override fun loadAfter(params: LoadParams<Int>, callback: LoadCallback<Int, Movie>) {
        val page = params.key + 1
        compositeDisposable.add(movieRepository.getMovies(page)
            .subscribeOn(Schedulers.io())
            .observeOn(AndroidSchedulers.mainThread())
            .subscribe({
                Log.d("Page ${it.data.pageNumber}", "${it.data.movies.size} Movies")
                callback.onResult(it.data.movies, page)
            }, {
                Log.e("Error", it.message!!)
                loadAfter(params, callback)
            })
        )
    }

    override fun loadBefore(params: LoadParams<Int>, callback: LoadCallback<Int, Movie>) {
        val page = params.key - 1
        compositeDisposable.add(movieRepository.getMovies(page)
            .subscribeOn(Schedulers.io())
            .observeOn(AndroidSchedulers.mainThread())
            .subscribe({
                Log.d("Page ${it.data.pageNumber}", "${it.data.movies.size} Movies")
                callback.onResult(it.data.movies, page)
            }, {
                Log.e("Error", it.message!!)
                loadAfter(params, callback)
            })
        )
    }

    fun clear() = compositeDisposable.clear()
}