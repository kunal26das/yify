package io.github.kunal26das.yify.preference

import androidx.datastore.preferences.core.MutablePreferences
import javax.inject.Inject

class MutableMoviePreferencesImpl @Inject constructor(
    private val mutablePreferences: MutablePreferences?
) : MutableMoviePreferences {
    override fun setQuality(quality: String?) {
        if (quality == null) mutablePreferences?.remove(Preference.quality.stringPreferencesKey)
        else mutablePreferences?.set(Preference.quality.stringPreferencesKey, quality)
    }

    override fun setMinimumRating(minimumRating: Int?) {
        if (minimumRating == null) mutablePreferences?.remove(Preference.minimum_rating.intPreferencesKey)
        else mutablePreferences?.set(Preference.minimum_rating.intPreferencesKey, minimumRating)
    }

    override fun setQueryTerm(queryTerm: String?) {
        if (queryTerm == null) mutablePreferences?.remove(Preference.query_term.stringPreferencesKey)
        else mutablePreferences?.set(Preference.query_term.stringPreferencesKey, queryTerm)
    }

    override fun setGenre(genre: String?) {
        if (genre == null) mutablePreferences?.remove(Preference.genre.stringPreferencesKey)
        else mutablePreferences?.set(Preference.genre.stringPreferencesKey, genre)
    }

    override fun setSortBy(sortBy: String?) {
        if (sortBy == null) mutablePreferences?.remove(Preference.sort_by.stringPreferencesKey)
        else mutablePreferences?.set(Preference.sort_by.stringPreferencesKey, sortBy)
    }

    override fun setOrderBy(orderBy: String?) {
        if (orderBy == null) mutablePreferences?.remove(Preference.order_by.stringPreferencesKey)
        else mutablePreferences?.set(Preference.order_by.stringPreferencesKey, orderBy)
    }

    override fun setMovieCount(movieCount: Int?) {
        if (movieCount == null) mutablePreferences?.remove(Preference.movie_count.intPreferencesKey)
        else mutablePreferences?.set(Preference.movie_count.intPreferencesKey, movieCount)
    }
}