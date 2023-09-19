package io.github.kunal26das.yify.db

import io.github.kunal26das.yify.domain.db.FlowPreference
import io.github.kunal26das.yify.domain.db.ImmutablePreference
import io.github.kunal26das.yify.domain.model.Genre
import kotlinx.coroutines.flow.first
import javax.inject.Inject

class ImmutablePreferenceImpl @Inject constructor(
    private val flowPreference: FlowPreference
) : ImmutablePreference {
    override suspend fun getMovieCount(genre: Genre?): Int? {
        return flowPreference.getMovieCount(genre).first()
    }
}