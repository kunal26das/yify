package io.github.kunal26das.yify.domain.player

interface MediaPlayer {
    fun prepare()
    fun setVideoUrl(url: String)
    fun release()
}