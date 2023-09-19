package io.github.kunal26das.yify.db

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import io.github.kunal26das.yify.domain.db.MutablePreference
import io.github.kunal26das.yify.domain.model.Genre
import javax.inject.Inject

class MutablePreferencesImpl @Inject constructor(
    private val dataStore: DataStore<Preferences>
) : MutablePreference {

    private suspend fun setIntPreference(key: String, value: Int) {
        dataStore.edit {
            it[intPreferencesKey(key)] = value
        }
    }

    override suspend fun setMovieCount(value: Int, genre: Genre?) {
        setIntPreference(genre?.name ?: PreferencesKey.ALL_GENRES, value)
    }
}