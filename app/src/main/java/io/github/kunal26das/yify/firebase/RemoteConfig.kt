package io.github.kunal26das.yify.firebase

import com.google.firebase.ktx.Firebase
import com.google.firebase.remoteconfig.FirebaseRemoteConfigValue
import com.google.firebase.remoteconfig.ktx.remoteConfig
import com.google.firebase.remoteconfig.ktx.remoteConfigSettings
import io.github.kunal26das.yify.models.Constants

class RemoteConfig private constructor() : HashMap<String, FirebaseRemoteConfigValue>() {

    companion object {

        @Synchronized
        fun fetchAndActivate(onCompleteListener: () -> Unit) {
            Firebase.remoteConfig.apply {
                setConfigSettingsAsync(remoteConfigSettings {
                    minimumFetchIntervalInSeconds = 0
                })
                fetchAndActivate().addOnCompleteListener {
                    val all = Firebase.remoteConfig.all
                    onCompleteListener.invoke()
                    RemoteConfig().putAll(all)
                }
            }
        }

        operator fun get(@Constants key: String) = RemoteConfig()[key]!!

    }

}
