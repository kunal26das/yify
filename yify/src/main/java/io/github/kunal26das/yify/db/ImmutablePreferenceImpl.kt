package io.github.kunal26das.yify.db

import io.github.kunal26das.yify.domain.db.FlowPreference
import io.github.kunal26das.yify.domain.db.ImmutablePreference
import kotlinx.coroutines.flow.first
import javax.inject.Inject

class ImmutablePreferenceImpl @Inject constructor(
    private val flowPreference: FlowPreference
) : ImmutablePreference {
    override suspend fun getMaxMovieCount(): Int? {
        return flowPreference.getMaxMovieCount().first()
    }

    override suspend fun getCurrentMovieCount(): Int? {
        return flowPreference.getCurrentMovieCount().first()
    }
}