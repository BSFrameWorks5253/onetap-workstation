package com.onetap.studiotracker.util

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.onetap.studiotracker.data.models.SafarCampaign
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

class AudioBriefingPlayer(context: Context) : TextToSpeech.OnInitListener {

    private var tts: TextToSpeech? = TextToSpeech(context.applicationContext, this)
    private var isInitialized = false

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.language = Locale.US
            tts?.setSpeechRate(1.0f)
            tts?.setPitch(1.0f)
            isInitialized = true

            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    _isPlaying.value = true
                }

                override fun onDone(utteranceId: String?) {
                    _isPlaying.value = false
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    _isPlaying.value = false
                }
            })
        }
    }

    fun playCampaignBriefing(campaign: SafarCampaign) {
        if (!isInitialized) return

        if (_isPlaying.value) {
            stop()
            return
        }

        val speechText = buildAudioScript(campaign)
        tts?.speak(speechText, TextToSpeech.QUEUE_FLUSH, null, "briefing_audio_${campaign.id}")
    }

    fun stop() {
        tts?.stop()
        _isPlaying.value = false
    }

    fun release() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }

    private fun buildAudioScript(campaign: SafarCampaign): String {
        val total = campaign.tasks.size
        val delivered = campaign.deliveredVideosCount
        val pending = total - delivered
        val percent = campaign.overallPercentage

        return if (campaign.is100PercentDone) {
            "Attention One Tap Studio team. Executive milestone reached for ${campaign.name}. " +
                    "All ${total} scheduled dates and Google Drive photos are 100 percent delivered and archived. Outstanding work team!"
        } else {
            "Executive production update for ${campaign.name}. " +
                    "Overall completion is currently at ${percent} percent. " +
                    "${delivered} of ${total} scheduled video dates are delivered. ${pending} are in the pipeline. " +
                    "${campaign.uploadedPhotosCount} photos have been synced to Google Drive. " +
                    "Keep up the great velocity!"
        }
    }
}
