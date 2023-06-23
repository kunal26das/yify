package io.github.kunal26das.yify.preference

import kotlinx.coroutines.flow.Flow

interface ObservableMoviePreferences {
    fun getQualityFlow(): Flow<String?>
    fun getMinimumRatingFlow(): Flow<Int?>
    fun getQueryTermFlow(): Flow<String?>
    fun getGenreFlow(): Flow<String?>
    fun getSortByFlow(): Flow<String?>
    fun getOrderByFlow(): Flow<String?>
}