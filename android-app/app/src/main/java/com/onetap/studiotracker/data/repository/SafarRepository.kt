package com.onetap.studiotracker.data.repository

import com.onetap.studiotracker.data.models.PhotoStage
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.models.Stage
import com.onetap.studiotracker.data.models.StudioStats
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map

class SafarRepository private constructor() {

    private val _campaigns = MutableStateFlow<List<SafarCampaign>>(SampleDataProvider.getSampleCampaigns())
    val campaigns: StateFlow<List<SafarCampaign>> = _campaigns.asStateFlow()

    private val _activeCampaignId = MutableStateFlow<String?>(
        _campaigns.value.firstOrNull { it.isOngoing }?.id ?: _campaigns.value.firstOrNull()?.id
    )
    val activeCampaignId: StateFlow<String?> = _activeCampaignId.asStateFlow()

    fun getActiveCampaignFlow(): StateFlow<SafarCampaign?> {
        val flow = MutableStateFlow(_campaigns.value.firstOrNull { it.id == _activeCampaignId.value })
        return flow.asStateFlow()
    }

    val activeCampaign: SafarCampaign?
        get() = _campaigns.value.firstOrNull { it.id == _activeCampaignId.value } ?: _campaigns.value.firstOrNull()

    fun getStudioStats(): StudioStats {
        return StudioStats.calculate(_campaigns.value)
    }

    fun setActiveCampaign(campaignId: String) {
        _activeCampaignId.value = campaignId
        // Also update isOngoing flag
        _campaigns.value = _campaigns.value.map {
            it.copy(isOngoing = (it.id == campaignId))
        }
    }

    fun updateTaskStage(taskId: String, newStage: Stage) {
        _campaigns.value = _campaigns.value.map { campaign ->
            val updatedTasks = campaign.tasks.map { task ->
                if (task.id == taskId) {
                    task.copy(stage = newStage, updatedAt = System.currentTimeMillis())
                } else {
                    task
                }
            }
            campaign.copy(tasks = updatedTasks)
        }
    }

    fun updateTaskPhotos(taskId: String, uploadedCount: Int, photoStage: PhotoStage) {
        _campaigns.value = _campaigns.value.map { campaign ->
            val updatedTasks = campaign.tasks.map { task ->
                if (task.id == taskId) {
                    val clampedUploaded = uploadedCount.coerceIn(0, task.totalPhotos)
                    task.copy(
                        uploadedPhotos = clampedUploaded,
                        photoStage = photoStage,
                        updatedAt = System.currentTimeMillis()
                    )
                } else {
                    task
                }
            }
            campaign.copy(tasks = updatedTasks)
        }
    }

    /**
     * Generates a sleek, executive-level WhatsApp daily briefing message.
     * Includes clear milestone indicators, uploaded vs pending breakdown,
     * and a 100% completion celebration banner when all dates/photos are done.
     */
    fun generateWhatsAppBriefingText(campaign: SafarCampaign): String {
        val totalDays = campaign.tasks.size
        val videoDelivered = campaign.deliveredVideosCount
        val videoPending = totalDays - videoDelivered
        val overallPercent = campaign.overallPercentage
        val is100Done = campaign.is100PercentDone

        val sb = StringBuilder()
        sb.append("📋 *ONE TAP STUDIO | SAFAR EXECUTIVE BRIEFING*\n")
        sb.append("━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("📍 *Campaign:* ${campaign.name}\n")
        sb.append("🌐 *Location:* ${campaign.location}\n")
        sb.append("📅 *Timeline:* ${campaign.startDate} – ${campaign.endDate}\n\n")

        if (is100Done) {
            sb.append("🏆 *MILESTONE REACHED: 100% FULLY DELIVERED!*\n")
            sb.append("✨ All scheduled dates videos and Google Drive photo batches are archived and uploaded successfully!\n\n")
        } else {
            val filledBars = (overallPercent / 10).coerceIn(0, 10)
            val emptyBars = 10 - filledBars
            val progressBar = "█".repeat(filledBars) + "░".repeat(emptyBars)
            sb.append("📊 *Progress Completion:* *$overallPercent%*\n")
            sb.append("`[$progressBar]`\n\n")
        }

        sb.append("🎬 *Video Production Pipeline:*\n")
        sb.append(" • Total Scheduled Dates: *$totalDays*\n")
        sb.append(" • Delivered / Uploaded: *$videoDelivered* ✅\n")
        sb.append(" • Pending / In Production: *$videoPending* ⏳\n\n")

        sb.append("📸 *Google Drive Photo Coverage:*\n")
        sb.append(" • Total Master Photos: *${campaign.totalPhotosCount}*\n")
        sb.append(" • Uploaded to Drive: *${campaign.uploadedPhotosCount}* (${campaign.photoUploadPercentage}%)\n")
        sb.append(" • Dates Completed: *${campaign.deliveredPhotosCount}/$totalDays*\n\n")

        sb.append("🗓️ *Date-by-Date Schedule Status:*\n")
        campaign.tasks.forEachIndexed { index, task ->
            val icon = when (task.stage) {
                Stage.ALJAMEA_DONE -> "🏛️"
                Stage.UPLOADED -> "✅"
                Stage.UPLOAD_PENDING -> "⏳"
                Stage.IN_PROGRESS -> "⚙️"
                Stage.EDITING_PENDING -> "📝"
            }
            val photoIndicator = if (task.isPhotosDelivered) "📸✓" else "📸(${task.uploadedPhotos}/${task.totalPhotos})"
            sb.append("${index + 1}. $icon *${task.title}* [${task.stage.title}] — $photoIndicator\n")
        }

        sb.append("\n━━━━━━━━━━━━━━━━━━━━\n")
        sb.append("⚡ *One Tap Studio Tracker* • _Auto-generated Production Report_")
        return sb.toString()
    }

    companion object {
        @Volatile
        private var instance: SafarRepository? = null

        fun getInstance(): SafarRepository {
            return instance ?: synchronized(this) {
                instance ?: SafarRepository().also { instance = it }
            }
        }
    }
}
