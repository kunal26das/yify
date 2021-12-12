package io.github.kunal26das.yify.firebase

import com.google.firebase.ktx.Firebase
import com.google.firebase.remoteconfig.ktx.remoteConfig
import com.google.firebase.remoteconfig.ktx.remoteConfigSettings
import io.github.kunal26das.core.model.Constants

object RemoteConfig {

    @Synchronized
    fun fetchAndActivate(onCompleteListener: () -> Unit) {
        Firebase.remoteConfig.apply {
            setConfigSettingsAsync(remoteConfigSettings {
                minimumFetchIntervalInSeconds = 0
            })
            fetchAndActivate().addOnCompleteListener {
                onCompleteListener.invoke()
            }
        }
    }

    operator fun get(@Constants key: String) = Firebase.remoteConfig.all[key]!!

}
