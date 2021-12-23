package io.github.kunal26das.yify.firebase

import com.google.firebase.ktx.Firebase
import com.google.firebase.remoteconfig.FirebaseRemoteConfigValue
import com.google.firebase.remoteconfig.ktx.remoteConfig
import com.google.firebase.remoteconfig.ktx.remoteConfigSettings
import io.github.kunal26das.model.Constants
import io.github.kunal26das.network.OnCompleteListener

object RemoteConfig {

    @Synchronized
    fun fetchAndActivate(onCompleteListener: OnCompleteListener<Boolean>? = null) {
        Firebase.remoteConfig.apply {
            setConfigSettingsAsync(remoteConfigSettings {
                minimumFetchIntervalInSeconds = 0
            })
            fetchAndActivate().addOnCompleteListener {
                onCompleteListener?.invoke(it.result)
            }
        }
    }

    operator fun get(key: Constants): FirebaseRemoteConfigValue {
        return Firebase.remoteConfig.all[key.name.lowercase()]!!
    }

}
