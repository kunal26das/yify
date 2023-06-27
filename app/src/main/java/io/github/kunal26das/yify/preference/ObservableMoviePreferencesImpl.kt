package io.github.kunal26das.yify.preference

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.lifecycle.LiveData
import androidx.lifecycle.asLiveData
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class ObservableMoviePreferencesImpl @Inject constructor(
    private val dataStore: DataStore<Preferences>
) : ObservableMoviePreferences {
    override fun getQualityLiveData(): LiveData<String?> {
        return dataStore.data.map {
            it[Preference.quality.stringPreferencesKey]
        }.asLiveData()
    }

    override fun getMinimumRatingLiveData(): LiveData<Int?> {
        return dataStore.data.map {
            it[Preference.minimum_rating.intPreferencesKey]
        }.asLiveData()
    }

    override fun getQueryTermLiveData(): LiveData<String?> {
        return dataStore.data.map {
            it[Preference.query_term.stringPreferencesKey]
        }.asLiveData()
    }

    override fun getGenreLiveData(): LiveData<String?> {
        return dataStore.data.map {
            it[Preference.genre.stringPreferencesKey]
        }.asLiveData()
    }

    override fun getSortByLiveData(): LiveData<String?> {
        return dataStore.data.map {
            it[Preference.sort_by.stringPreferencesKey]
        }.asLiveData()
    }

    override fun getOrderByLiveData(): LiveData<String?> {
        return dataStore.data.map {
            it[Preference.order_by.stringPreferencesKey]
        }.asLiveData()
    }
}