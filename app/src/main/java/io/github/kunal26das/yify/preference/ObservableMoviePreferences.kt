package io.github.kunal26das.yify.preference

import androidx.lifecycle.LiveData

interface ObservableMoviePreferences {
    fun getQualityLiveData(): LiveData<String?>
    fun getMinimumRatingLiveData(): LiveData<Int?>
    fun getQueryTermLiveData(): LiveData<String?>
    fun getGenreLiveData(): LiveData<String?>
    fun getSortByLiveData(): LiveData<String?>
    fun getOrderByLiveData(): LiveData<String?>
}