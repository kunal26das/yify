package io.github.kunal26das.yify.db

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.intPreferencesKey
import io.github.kunal26das.yify.domain.db.FlowPreference
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class FlowPreferenceImpl @Inject constructor(
    private val dataStore: DataStore<Preferences>
) : FlowPreference {
    private fun getIntPreferenceFlow(key: String): Flow<Int?> {
        return dataStore.data.map { it[intPreferencesKey(key)] }
    }
}