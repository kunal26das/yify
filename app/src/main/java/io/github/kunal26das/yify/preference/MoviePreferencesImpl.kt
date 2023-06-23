package io.github.kunal26das.yify.preference

import androidx.datastore.preferences.core.Preferences
import io.github.kunal26das.model.Preference
import javax.inject.Inject

class MoviePreferencesImpl @Inject constructor(
    private val preferences: Preferences?
) : MoviePreferences {
    override fun getQuality(): String? {
        return preferences?.get(Preference.quality.stringPreferencesKey)
    }

    override fun getMinimumRating(): Int? {
        return preferences?.get(Preference.minimum_rating.intPreferencesKey)
    }

    override fun getQueryTerm(): String? {
        return preferences?.get(Preference.query_term.stringPreferencesKey)
    }

    override fun getGenre(): String? {
        return preferences?.get(Preference.genre.stringPreferencesKey)
    }

    override fun getSortBy(): String? {
        return preferences?.get(Preference.sort_by.stringPreferencesKey)
    }

    override fun getOrderBy(): String? {
        return preferences?.get(Preference.order_by.stringPreferencesKey)
    }
}