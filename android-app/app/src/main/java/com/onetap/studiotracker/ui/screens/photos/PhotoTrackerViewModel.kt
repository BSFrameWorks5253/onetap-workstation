package com.onetap.studiotracker.ui.screens.photos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.onetap.studiotracker.data.models.PhotoStage
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.repository.SafarRepository
import com.onetap.studiotracker.data.sync.DrivePhotoFolderInfo
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

class PhotoTrackerViewModel : ViewModel() {

    private val repository: SafarRepository = SafarRepository.getInstance()

    val campaigns: StateFlow<List<SafarCampaign>> = repository.campaigns

    val activeCampaign: StateFlow<SafarCampaign?> = repository.campaigns.map { list ->
        list.firstOrNull { it.isOngoing } ?: list.firstOrNull { !it.isArchived } ?: list.firstOrNull()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val drivePhotoInfo: StateFlow<Map<String, DrivePhotoFolderInfo>> = repository.drivePhotoInfo

    fun updatePhotoStage(task: SafarTask, newStage: PhotoStage) {
        repository.updateTaskPhotoStage(task.id, newStage)
    }

    fun batchMarkUploaded(taskIds: Set<String>) {
        repository.batchUpdatePhotoStage(taskIds, PhotoStage.UPLOADED)
    }

    fun syncDriveFolders(campaign: SafarCampaign) {
        repository.syncDrivePhotoFolders(campaign.name, campaign.tasks.map { it.title })
    }
}
