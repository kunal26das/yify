package io.github.kunal26das.yify.movie.filter

import androidx.essentials.network.local.Preferences
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.kunal26das.model.Preference
import javax.inject.Inject

@HiltViewModel
class MovieFilterViewModel @Inject constructor(
    preferences: Preferences
) : ViewModel() {

    val genre by preferences.mutableLiveDataOf<String>(Preference.genre)
    val sortBy by preferences.mutableLiveDataOf<String>(Preference.sort_by)
    val quality by preferences.mutableLiveDataOf<String>(Preference.quality)
    val orderBy by preferences.mutableLiveDataOf<String>(Preference.order_by)
    val queryTerm by preferences.mutableLiveDataOf<String>(Preference.query_term)
    val minimumRating by preferences.mutableLiveDataOf<Int>(Preference.minimum_rating)

}