package com.onetap.studiotracker.ui.screens.photos

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.onetap.studiotracker.data.models.PhotoStage
import com.onetap.studiotracker.data.models.SafarCampaign
import com.onetap.studiotracker.data.models.SafarTask
import com.onetap.studiotracker.data.repository.SafarRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

class PhotoTrackerViewModel : ViewModel() {

    private val repository: SafarRepository = SafarRepository.getInstance()

    val activeCampaign: StateFlow<SafarCampaign?> = repository.campaigns.map { list ->
        list.firstOrNull { it.isOngoing } ?: list.firstOrNull()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    fun updatePhotoStage(task: SafarTask, newStage: PhotoStage) {
        val newCount = if (newStage == PhotoStage.DRIVE_UPLOADED) {
            task.totalPhotos
        } else {
            task.uploadedPhotos
        }
        repository.updateTaskPhotos(task.id, newCount, newStage)
    }

    fun adjustPhotoCount(task: SafarTask, delta: Int) {
        val updatedCount = (task.uploadedPhotos + delta).coerceIn(0, task.totalPhotos)
        val newStage = if (updatedCount >= task.totalPhotos && task.totalPhotos > 0) {
            PhotoStage.DRIVE_UPLOADED
        } else if (updatedCount > 0) {
            PhotoStage.COLOR_GRADED
        } else {
            task.photoStage
        }
        repository.updateTaskPhotos(task.id, updatedCount, newStage)
    }

    fun markAllPhotosUploaded(task: SafarTask) {
        repository.updateTaskPhotos(task.id, task.totalPhotos, PhotoStage.DRIVE_UPLOADED)
    }
}
