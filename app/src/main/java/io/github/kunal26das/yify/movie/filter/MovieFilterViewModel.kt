package io.github.kunal26das.yify.movie.filter

import android.content.SharedPreferences
import androidx.essentials.network.mutableLiveDataOf
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.model.Preference
import javax.inject.Inject

@HiltViewModel
class MovieFilterViewModel @Inject constructor(
    sharedPreferences: SharedPreferences
) : ViewModel() {

    val genre by sharedPreferences.mutableLiveDataOf<String>(Preference.genre)
    val sortBy by sharedPreferences.mutableLiveDataOf<String>(Preference.sort_by)
    val quality by sharedPreferences.mutableLiveDataOf<String>(Preference.quality)
    val orderBy by sharedPreferences.mutableLiveDataOf<String>(Preference.order_by)
    val queryTerm by sharedPreferences.mutableLiveDataOf<String>(Preference.query_term)
    val minimumRating by sharedPreferences.mutableLiveDataOf<Int>(Preference.minimum_rating)

}