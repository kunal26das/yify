package io.github.kunal26das.yify.preference

import androidx.datastore.preferences.core.Preferences
import io.github.kunal26das.model.Preference
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class ObservableMoviePreferencesImpl @Inject constructor(
    private val data: Flow<Preferences>
) : ObservableMoviePreferences {
    override fun getQualityFlow(): Flow<String?> {
        return data.map {
            it[Preference.quality.stringPreferencesKey]
        }
    }

    override fun getMinimumRatingFlow(): Flow<Int?> {
        return data.map {
            it[Preference.minimum_rating.intPreferencesKey]
        }
    }

    override fun getQueryTermFlow(): Flow<String?> {
        return data.map {
            it[Preference.query_term.stringPreferencesKey]
        }
    }

    override fun getGenreFlow(): Flow<String?> {
        return data.map {
            it[Preference.genre.stringPreferencesKey]
        }
    }

    override fun getSortByFlow(): Flow<String?> {
        return data.map {
            it[Preference.sort_by.stringPreferencesKey]
        }
    }

    override fun getOrderByFlow(): Flow<String?> {
        return data.map {
            it[Preference.order_by.stringPreferencesKey]
        }
    }
}