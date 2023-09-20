package io.github.kunal26das.yify.db

import io.github.kunal26das.yify.domain.db.FlowPreference
import io.github.kunal26das.yify.domain.db.ImmutablePreference
import javax.inject.Inject

class ImmutablePreferenceImpl @Inject constructor(
    private val flowPreference: FlowPreference
) : ImmutablePreference